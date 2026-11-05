import type pg from "pg";
import type { Rol } from "@plomada/shared";
import type { UsuarioRepositoryPort } from "../../application/ports/usuario-repository.port";
import type { UsuarioConContrasena, UsuarioPublico } from "../../domain/usuario";

export class PgUsuarioRepository implements UsuarioRepositoryPort {
  constructor(private readonly pool: pg.Pool) {}

  async buscarPorId(id: string): Promise<UsuarioConContrasena | null> {
    const res = await this.pool.query<{
      id: string;
      nombre: string;
      correo: string;
      rol: Rol;
      contrasena_hash: string;
      creado_en: Date;
    }>("SELECT id, nombre, correo, rol, contrasena_hash, creado_en FROM usuarios WHERE id = $1", [id]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      nombre: r.nombre,
      correo: r.correo,
      rol: r.rol,
      contrasenaHash: r.contrasena_hash,
      creadoEn: r.creado_en,
    };
  }

  async buscarPorCorreo(correo: string): Promise<UsuarioConContrasena | null> {
    const res = await this.pool.query<{
      id: string;
      nombre: string;
      correo: string;
      rol: Rol;
      contrasena_hash: string;
      creado_en: Date;
    }>("SELECT id, nombre, correo, rol, contrasena_hash, creado_en FROM usuarios WHERE LOWER(correo) = LOWER($1)", [correo]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      nombre: r.nombre,
      correo: r.correo,
      rol: r.rol,
      contrasenaHash: r.contrasena_hash,
      creadoEn: r.creado_en,
    };
  }

  async listar(filtro?: { rol?: Rol }): Promise<UsuarioPublico[]> {
    let sql = "SELECT id, nombre, correo, rol FROM usuarios";
    const params: unknown[] = [];
    if (filtro?.rol) {
      sql += " WHERE rol = $1";
      params.push(filtro.rol);
    }
    sql += " ORDER BY nombre ASC";

    const res = await this.pool.query<UsuarioPublico>(sql, params);
    return res.rows;
  }

  async guardar(usuario: UsuarioConContrasena): Promise<void> {
    await this.pool.query(
      `INSERT INTO usuarios (id, nombre, correo, rol, contrasena_hash, creado_en)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         correo = EXCLUDED.correo,
         rol = EXCLUDED.rol,
         contrasena_hash = EXCLUDED.contrasena_hash`,
      [usuario.id, usuario.nombre, usuario.correo, usuario.rol, usuario.contrasenaHash, usuario.creadoEn],
    );
  }
}
