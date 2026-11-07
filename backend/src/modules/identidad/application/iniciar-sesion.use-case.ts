import crypto from "node:crypto";
import type { LoginSolicitud, SesionRespuesta } from "@plomada/shared";
import { CredencialesInvalidasError } from "../domain/errores";
import type { PasswordHasherPort } from "./ports/password-hasher.port";
import type { SesionRepositoryPort } from "./ports/sesion-repository.port";
import type { TokenServicePort } from "./ports/token-service.port";
import type { UsuarioRepositoryPort } from "./ports/usuario-repository.port";

export class IniciarSesionUseCase {
  constructor(
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly sesionRepo: SesionRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly tokenService: TokenServicePort,
  ) {}

  async ejecutar(input: LoginSolicitud): Promise<SesionRespuesta> {
    const usuario = await this.usuarioRepo.buscarPorCorreo(
      input.correo.toLowerCase().trim(),
    );
    if (!usuario) {
      throw new CredencialesInvalidasError();
    }

    const valida = await this.hasher.verificar(
      usuario.contrasenaHash,
      input.contrasena,
    );
    if (!valida) {
      throw new CredencialesInvalidasError();
    }

    const { token: accessToken, expiraEn } =
      await this.tokenService.generarAccessToken({
        id: usuario.id,
        correo: usuario.correo,
        rol: usuario.rol,
      });

    const { token: refreshToken, hash: refreshTokenHash } =
      await this.tokenService.generarRefreshToken();

    // 7 días de duración para el refresh token
    const expiraEnDate = new Date();
    expiraEnDate.setDate(expiraEnDate.getDate() + 7);

    await this.sesionRepo.guardar({
      id: crypto.randomUUID(),
      usuarioId: usuario.id,
      tokenRefrescoHash: refreshTokenHash,
      expiraEn: expiraEnDate,
      creadoEn: new Date(),
    });

    return {
      accessToken,
      accessExpiraEn: expiraEn,
      refreshToken,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    };
  }
}
