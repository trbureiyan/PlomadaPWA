import type { UsuarioPublico } from "../domain/usuario";
import { UsuarioNoEncontradoError } from "../domain/errores";
import type { UsuarioRepositoryPort } from "./ports/usuario-repository.port";

export class ObtenerUsuarioAutenticadoUseCase {
  constructor(private readonly usuarioRepo: UsuarioRepositoryPort) {}

  async ejecutar(id: string): Promise<UsuarioPublico> {
    const usuario = await this.usuarioRepo.buscarPorId(id);
    if (!usuario) {
      throw new UsuarioNoEncontradoError(id);
    }
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
    };
  }
}
