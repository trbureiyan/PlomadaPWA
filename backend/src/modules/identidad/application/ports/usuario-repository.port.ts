import type { Rol } from "@plomada/shared";
import type {
  UsuarioConContrasena,
  UsuarioPublico,
} from "../../domain/usuario";

export interface UsuarioRepositoryPort {
  buscarPorId(id: string): Promise<UsuarioConContrasena | null>;
  buscarPorCorreo(correo: string): Promise<UsuarioConContrasena | null>;
  listar(filtro?: { rol?: Rol }): Promise<UsuarioPublico[]>;
  guardar(usuario: UsuarioConContrasena): Promise<void>;
}
