import type pg from "pg";
import type { EstadoProgramacion, Fecha, Instante } from "@plomada/shared";
import type {
  AsignacionPersistida,
  ProgramacionPersistida,
  ProgramacionRepositoryPort,
} from "../../application/ports/programacion-repository.port";

export class PgProgramacionRepository implements ProgramacionRepositoryPort {
  constructor(private readonly pool: pg.Pool) {}

  async guardar(programacion: ProgramacionPersistida): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO programaciones_semanales (id, semana_inicio, estado, publicada_en)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           estado = EXCLUDED.estado,
           publicada_en = EXCLUDED.publicada_en`,
        [
          programacion.id,
          programacion.semanaInicio,
          programacion.estado,
          programacion.publicadaEn ?? null,
        ],
      );

      // Eliminar asignaciones y actividades anteriores si es reemplazo/update
      await client.query(
        "DELETE FROM asignaciones WHERE programacion_id = $1",
        [programacion.id],
      );

      for (const a of programacion.asignaciones) {
        await client.query(
          `INSERT INTO asignaciones (id, programacion_id, operario_id, centro_trabajo_id, fecha)
           VALUES ($1, $2, $3, $4, $5)`,
          [a.id, programacion.id, a.operarioId, a.centroTrabajoId, a.fecha],
        );

        for (const act of a.actividades) {
          await client.query(
            `INSERT INTO actividades (id, asignacion_id, descripcion)
             VALUES ($1, $2, $3)`,
            [act.id, a.id, act.descripcion],
          );
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async buscarPorId(id: string): Promise<ProgramacionPersistida | null> {
    const progRes = await this.pool.query<{
      id: string;
      semana_inicio: string;
      estado: EstadoProgramacion;
      publicada_en: Date | null;
    }>(
      "SELECT id, semana_inicio::text, estado, publicada_en FROM programaciones_semanales WHERE id = $1",
      [id],
    );

    if (progRes.rows.length === 0) return null;
    return this.cargarRelaciones(progRes.rows[0]);
  }

  async buscarPorSemana(
    semanaInicio: Fecha,
  ): Promise<ProgramacionPersistida | null> {
    const progRes = await this.pool.query<{
      id: string;
      semana_inicio: string;
      estado: EstadoProgramacion;
      publicada_en: Date | null;
    }>(
      "SELECT id, semana_inicio::text, estado, publicada_en FROM programaciones_semanales WHERE semana_inicio = $1",
      [semanaInicio],
    );

    if (progRes.rows.length === 0) return null;
    return this.cargarRelaciones(progRes.rows[0]);
  }

  async listar(filtro?: {
    semanaInicio?: Fecha;
  }): Promise<ProgramacionPersistida[]> {
    let sql =
      "SELECT id, semana_inicio::text, estado, publicada_en FROM programaciones_semanales";
    const params: unknown[] = [];
    if (filtro?.semanaInicio) {
      sql += " WHERE semana_inicio = $1";
      params.push(filtro.semanaInicio);
    }
    sql += " ORDER BY semana_inicio DESC";

    const res = await this.pool.query<{
      id: string;
      semana_inicio: string;
      estado: EstadoProgramacion;
      publicada_en: Date | null;
    }>(sql, params);

    const lista: ProgramacionPersistida[] = [];
    for (const row of res.rows) {
      lista.push(await this.cargarRelaciones(row));
    }
    return lista;
  }

  async buscarPublicadaParaOperario(
    operarioId: string,
    semanaInicio?: Fecha,
  ): Promise<ProgramacionPersistida | null> {
    let sql = `
      SELECT p.id, p.semana_inicio::text, p.estado, p.publicada_en
      FROM programaciones_semanales p
      JOIN asignaciones a ON a.programacion_id = p.id
      WHERE p.estado = 'publicada' AND a.operario_id = $1
    `;
    const params: unknown[] = [operarioId];
    if (semanaInicio) {
      sql += " AND p.semana_inicio = $2";
      params.push(semanaInicio);
    }
    // Sin semana, el respaldo es la publicada más reciente; sin ORDER BY sería una cualquiera.
    sql += " ORDER BY p.semana_inicio DESC LIMIT 1";

    const res = await this.pool.query<{
      id: string;
      semana_inicio: string;
      estado: EstadoProgramacion;
      publicada_en: Date | null;
    }>(sql, params);

    if (res.rows.length === 0) return null;
    return this.cargarRelaciones(res.rows[0]);
  }

  async actualizarEstado(
    id: string,
    estado: EstadoProgramacion,
    publicadaEn: Instante,
  ): Promise<void> {
    await this.pool.query(
      "UPDATE programaciones_semanales SET estado = $1, publicada_en = $2 WHERE id = $3",
      [estado, publicadaEn, id],
    );
  }

  private async cargarRelaciones(progRow: {
    id: string;
    semana_inicio: string;
    estado: EstadoProgramacion;
    publicada_en: Date | null;
  }): Promise<ProgramacionPersistida> {
    const asigRes = await this.pool.query<{
      id: string;
      operario_id: string;
      centro_trabajo_id: string;
      fecha: string;
    }>(
      "SELECT id, operario_id, centro_trabajo_id, fecha::text FROM asignaciones WHERE programacion_id = $1 ORDER BY fecha ASC",
      [progRow.id],
    );

    const asignaciones: AsignacionPersistida[] = [];

    for (const a of asigRes.rows) {
      const actRes = await this.pool.query<{ id: string; descripcion: string }>(
        "SELECT id, descripcion FROM actividades WHERE asignacion_id = $1 ORDER BY creado_en ASC",
        [a.id],
      );

      asignaciones.push({
        id: a.id,
        operarioId: a.operario_id,
        centroTrabajoId: a.centro_trabajo_id,
        fecha: a.fecha,
        actividades: actRes.rows.map((act) => ({
          id: act.id,
          descripcion: act.descripcion,
        })),
      });
    }

    return {
      id: progRow.id,
      semanaInicio: progRow.semana_inicio,
      estado: progRow.estado,
      publicadaEn: progRow.publicada_en
        ? progRow.publicada_en.toISOString()
        : undefined,
      asignaciones,
    };
  }
}
