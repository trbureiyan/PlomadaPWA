import { describe, it, expect } from "vitest";
import { validarFormularioUsuario } from "./AdminDashboard";

describe("C-9: Quitar la restricción de dominio del correo en el formulario de usuarios (nota 015)", () => {
  it("acepta a un operario con correo de cualquier dominio válido (ej: operario@empresa.com)", () => {
    const errs = validarFormularioUsuario({
      nombre: "Carlos Gómez",
      correo: "operario@empresa.com",
      rol: "operario",
      contrasena: "secreto1234",
    });

    expect(errs.correo).toBeUndefined();
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("acepta correos de diversos dominios válidos para todos los roles", () => {
    const roles = ["operario", "supervisor", "administrativo", "administrador"] as const;
    const dominios = [
      "carlos@constructora.com.co",
      "maria@servicioslocativos.com",
      "pablo@empresa.net",
      "demo@plomada.local",
    ];

    for (const rol of roles) {
      for (const correo of dominios) {
        const errs = validarFormularioUsuario({
          nombre: "Usuario de Prueba",
          correo,
          rol,
          contrasena: "claveSegura2026",
        });
        expect(errs.correo, `El rol ${rol} con correo ${correo} no debería fallar`).toBeUndefined();
      }
    }
  });

  it("rechaza formatos de correo electrónico inválidos sin importar el rol", () => {
    const correosInvalidos = [
      "invalido",
      "sin-arroba.com",
      "@sin-usuario.com",
      "usuario@",
      "usuario@dominio",
    ];

    for (const correo of correosInvalidos) {
      const errs = validarFormularioUsuario({
        nombre: "Usuario Prueba",
        correo,
        rol: "operario",
        contrasena: "claveSegura2026",
      });

      expect(errs.correo).toBe("Ingresa un correo válido (ej: usuario@empresa.com)");
    }
  });

  it("rechaza correos vacíos", () => {
    const errs = validarFormularioUsuario({
      nombre: "Usuario Prueba",
      correo: "   ",
      rol: "operario",
      contrasena: "claveSegura2026",
    });

    expect(errs.correo).toBe("El correo electrónico es obligatorio");
  });

  it("rechaza correos duplicados con respecto a usuarios existentes", () => {
    const usuariosExistentes = [
      { correo: "operario.existente@empresa.com" },
    ];

    const errs = validarFormularioUsuario(
      {
        nombre: "Nuevo Operario",
        correo: "OPERARIO.EXISTENTE@empresa.com",
        rol: "operario",
        contrasena: "claveSegura2026",
      },
      usuariosExistentes,
    );

    expect(errs.correo).toBe("Este correo electrónico ya se encuentra registrado en el sistema");
  });
});
