import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { IniciarSesionUseCase } from "./application/iniciar-sesion.use-case";
import { RenovarSesionUseCase } from "./application/renovar-sesion.use-case";
import { CrearUsuarioUseCase } from "./application/crear-usuario.use-case";
import { ObtenerUsuarioAutenticadoUseCase } from "./application/obtener-usuario-autenticado.use-case";
import { ListarUsuariosUseCase } from "./application/listar-usuarios.use-case";
import { InMemoryUsuarioRepository } from "./infrastructure/persistence/in-memory-usuario.repository";
import { InMemorySesionRepository } from "./infrastructure/persistence/in-memory-sesion.repository";
import { Argon2PasswordHasher } from "./infrastructure/security/argon2-password-hasher";
import { JoseTokenService } from "./infrastructure/security/jose-token-service";
import {
  CredencialesInvalidasError,
  SesionInvalidaError,
  CorreoYaRegistradoError,
} from "./domain/errores";

describe("Módulo Identidad", () => {
  const usuarioRepo = new InMemoryUsuarioRepository();
  const sesionRepo = new InMemorySesionRepository();
  const hasher = new Argon2PasswordHasher();
  const tokenService = new JoseTokenService(
    "secreto-de-pruebas-super-seguro-12345678",
    15,
  );

  const iniciarSesion = new IniciarSesionUseCase(
    usuarioRepo,
    sesionRepo,
    hasher,
    tokenService,
  );
  const renovarSesion = new RenovarSesionUseCase(
    usuarioRepo,
    sesionRepo,
    tokenService,
  );
  const crearUsuario = new CrearUsuarioUseCase(usuarioRepo, hasher);
  const obtenerUsuario = new ObtenerUsuarioAutenticadoUseCase(usuarioRepo);
  const listarUsuarios = new ListarUsuariosUseCase(usuarioRepo);

  it("crea un nuevo usuario y previene duplicados de correo", async () => {
    const nuevo = await crearUsuario.ejecutar({
      nombre: "Carlos Operario",
      correo: "carlos@plomada.local",
      rol: "operario",
      contrasenaInicial: "Password123!",
    });

    expect(nuevo.id).toBeDefined();
    expect(nuevo.correo).toBe("carlos@plomada.local");
    expect(nuevo.rol).toBe("operario");

    await expect(
      crearUsuario.ejecutar({
        nombre: "Carlos Duplicado",
        correo: "carlos@plomada.local",
        rol: "operario",
        contrasenaInicial: "Otra1234!",
      }),
    ).rejects.toThrow(CorreoYaRegistradoError);
  });

  it("crea un operario con correo de cualquier dominio", async () => {
    const nuevo = await crearUsuario.ejecutar({
      nombre: "Operario Externo",
      correo: "Operario@Empresa.com",
      rol: "operario",
      contrasenaInicial: "Password123!",
    });
    expect(nuevo.correo).toBe("operario@empresa.com");
    expect(nuevo.rol).toBe("operario");
  });

  it("inicia sesión correctamente con credenciales válidas", async () => {
    const sesion = await iniciarSesion.ejecutar({
      correo: "carlos@plomada.local",
      contrasena: "Password123!",
    });

    expect(sesion.accessToken).toBeDefined();
    expect(sesion.refreshToken).toBeDefined();
    expect(sesion.usuario.correo).toBe("carlos@plomada.local");

    const payload = await tokenService.verificarAccessToken(sesion.accessToken);
    expect(payload?.id).toBe(sesion.usuario.id);
    expect(payload?.rol).toBe("operario");
  });

  it("rechaza inicio de sesión con contraseña equivocada", async () => {
    await expect(
      iniciarSesion.ejecutar({
        correo: "carlos@plomada.local",
        contrasena: "Erronea!",
      }),
    ).rejects.toThrow(CredencialesInvalidasError);
  });

  it("renueva la sesión rotando el refresh token", async () => {
    const sesionInicial = await iniciarSesion.ejecutar({
      correo: "carlos@plomada.local",
      contrasena: "Password123!",
    });

    const sesionRenovada = await renovarSesion.ejecutar({
      refreshToken: sesionInicial.refreshToken,
    });

    expect(sesionRenovada.accessToken).toBeDefined();
    expect(sesionRenovada.refreshToken).toBeDefined();
    expect(sesionRenovada.refreshToken).not.toBe(sesionInicial.refreshToken);

    // Intentar reusar el refresh token anterior debe fallar (fue revocado)
    await expect(
      renovarSesion.ejecutar({
        refreshToken: sesionInicial.refreshToken,
      }),
    ).rejects.toThrow(SesionInvalidaError);
  });

  it("obtiene el usuario autenticado y lista usuarios con filtro de rol", async () => {
    const sesion = await iniciarSesion.ejecutar({
      correo: "carlos@plomada.local",
      contrasena: "Password123!",
    });

    const perfil = await obtenerUsuario.ejecutar(sesion.usuario.id);
    expect(perfil.nombre).toBe("Carlos Operario");

    const todos = await listarUsuarios.ejecutar();
    expect(todos.length).toBeGreaterThanOrEqual(1);

    const supervisores = await listarUsuarios.ejecutar({ rol: "supervisor" });
    expect(supervisores.length).toBe(0);
  });
});
