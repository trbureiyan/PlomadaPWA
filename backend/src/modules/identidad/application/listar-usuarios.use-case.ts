import type { UsuariosFiltro } from "@plomada/shared";
import type { UsuarioPublico } from "../domain/usuario";
import type { UsuarioRepositoryPort } from "./ports/usuario-repository.port";

export class ListarUsuariosUseCase {
  constructor(private readonly usuarioRepo: UsuarioRepositoryPort) {}

  async ejecutar(filtro?: UsuariosFiltro): Promise<UsuarioPublico[]> {
    return this.usuarioRepo.listar(filtro);
  }
}
