import type { Rol } from "@plomada/shared";
import type { UsuarioRepositoryPort } from "../../application/ports/usuario-repository.port";
import type { UsuarioConContrasena, UsuarioPublico } from "../../domain/usuario";

export class InMemoryUsuarioRepository implements UsuarioRepositoryPort {
  private readonly usuarios = new Map<string, UsuarioConContrasena>();

  async buscarPorId(id: string): Promise<UsuarioConContrasena | null> {
    return this.usuarios.get(id) ?? null;
  }

  async buscarPorCorreo(correo: string): Promise<UsuarioConContrasena | null> {
    const normalizado = correo.toLowerCase().trim();
    for (const u of this.usuarios.values()) {
      if (u.correo.toLowerCase() === normalizado) {
        return u;
      }
    }
    return null;
  }

  async listar(filtro?: { rol?: Rol }): Promise<UsuarioPublico[]> {
    let lista = Array.from(this.usuarios.values());
    if (filtro?.rol) {
      lista = lista.filter((u) => u.rol === filtro.rol);
    }
    return lista.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      correo: u.correo,
      rol: u.rol,
    }));
  }

  async guardar(usuario: UsuarioConContrasena): Promise<void> {
    this.usuarios.set(usuario.id, { ...usuario });
  }

  limpiar(): void {
    this.usuarios.clear();
  }
}
