import crypto from "node:crypto";
import type { RefrescoSolicitud, SesionRespuesta } from "@plomada/shared";
import { SesionInvalidaError, UsuarioNoEncontradoError } from "../domain/errores";
import type { SesionRepositoryPort } from "./ports/sesion-repository.port";
import type { TokenServicePort } from "./ports/token-service.port";
import type { UsuarioRepositoryPort } from "./ports/usuario-repository.port";

export class RenovarSesionUseCase {
  constructor(
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly sesionRepo: SesionRepositoryPort,
    private readonly tokenService: TokenServicePort,
  ) {}

  async ejecutar(input: RefrescoSolicitud): Promise<SesionRespuesta> {
    const tokenHash = await this.tokenService.hashRefreshToken(input.refreshToken);
    const sesion = await this.sesionRepo.buscarPorTokenHash(tokenHash);

    if (!sesion) {
      throw new SesionInvalidaError("Sesión no encontrada");
    }

    if (sesion.revocadoEn) {
      throw new SesionInvalidaError("El token de refresco ya fue utilizado o revocado");
    }

    if (new Date() > new Date(sesion.expiraEn)) {
      throw new SesionInvalidaError("El token de refresco ha expirado");
    }

    // Revocar la sesión anterior (rotación de refresh tokens)
    await this.sesionRepo.revocar(sesion.id, new Date());

    const usuario = await this.usuarioRepo.buscarPorId(sesion.usuarioId);
    if (!usuario) {
      throw new UsuarioNoEncontradoError(sesion.usuarioId);
    }

    const { token: accessToken, expiraEn } = await this.tokenService.generarAccessToken({
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
    });

    const { token: nuevoRefreshToken, hash: nuevoRefreshTokenHash } = await this.tokenService.generarRefreshToken();

    const nuevaExpiraEn = new Date();
    nuevaExpiraEn.setDate(nuevaExpiraEn.getDate() + 7);

    await this.sesionRepo.guardar({
      id: crypto.randomUUID(),
      usuarioId: usuario.id,
      tokenRefrescoHash: nuevoRefreshTokenHash,
      expiraEn: nuevaExpiraEn,
      creadoEn: new Date(),
    });

    return {
      accessToken,
      accessExpiraEn: expiraEn,
      refreshToken: nuevoRefreshToken,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    };
  }
}
