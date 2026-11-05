import type pg from "pg";
import type { CentroTrabajo } from "@plomada/shared";
import type { CentroTrabajoRepositoryPort } from "../../application/ports/centro-trabajo-repository.port";

export class PgCentroTrabajoRepository implements CentroTrabajoRepositoryPort {
  constructor(private readonly pool: pg.Pool) {}

  async guardar(centro: CentroTrabajo): Promise<void> {
    await this.pool.query(
      `INSERT INTO centros_trabajo (id, nombre, direccion)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         direccion = EXCLUDED.direccion`,
      [centro.id, centro.nombre, centro.direccion ?? null],
    );
  }

  async buscarPorId(id: string): Promise<CentroTrabajo | null> {
    const res = await this.pool.query<{ id: string; nombre: string; direccion: string | null }>(
      "SELECT id, nombre, direccion FROM centros_trabajo WHERE id = $1",
      [id],
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      nombre: r.nombre,
      direccion: r.direccion ?? undefined,
    };
  }

  async listar(): Promise<CentroTrabajo[]> {
    const res = await this.pool.query<{ id: string; nombre: string; direccion: string | null }>(
      "SELECT id, nombre, direccion FROM centros_trabajo ORDER BY nombre ASC",
    );
    return res.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      direccion: r.direccion ?? undefined,
    }));
  }
}
