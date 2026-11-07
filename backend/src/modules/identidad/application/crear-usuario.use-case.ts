import crypto from "node:crypto";
import type { UsuarioCrear } from "@plomada/shared";
import type { UsuarioPublico } from "../domain/usuario";
import { CorreoYaRegistradoError } from "../domain/errores";
import type { PasswordHasherPort } from "./ports/password-hasher.port";
import type { UsuarioRepositoryPort } from "./ports/usuario-repository.port";

export class CrearUsuarioUseCase {
  constructor(
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async ejecutar(input: UsuarioCrear): Promise<UsuarioPublico> {
    const correoNormalizado = input.correo.toLowerCase().trim();

    const existente = await this.usuarioRepo.buscarPorCorreo(correoNormalizado);
    if (existente) {
      throw new CorreoYaRegistradoError(correoNormalizado);
    }

    const contrasenaHash = await this.hasher.hash(input.contrasenaInicial);
    const nuevoUsuario = {
      id: crypto.randomUUID(),
      nombre: input.nombre.trim(),
      correo: correoNormalizado,
      rol: input.rol,
      contrasenaHash,
      creadoEn: new Date(),
    };

    await this.usuarioRepo.guardar(nuevoUsuario);

    return {
      id: nuevoUsuario.id,
      nombre: nuevoUsuario.nombre,
      correo: nuevoUsuario.correo,
      rol: nuevoUsuario.rol,
    };
  }
}
