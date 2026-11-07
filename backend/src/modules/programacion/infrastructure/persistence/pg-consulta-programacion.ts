import type pg from "pg";
import type { Id } from "@plomada/shared";
import type { ConsultaProgramacionPort } from "../../application/ports/consulta-programacion.port";

export class PgConsultaProgramacion implements ConsultaProgramacionPort {
  constructor(private readonly pool: pg.Pool) {}

  async operarioDeActividad(actividadId: Id): Promise<Id | null> {
    const res = await this.pool.query<{ operario_id: string }>(
      `SELECT asig.operario_id
         FROM actividades act
         JOIN asignaciones asig ON asig.id = act.asignacion_id
        WHERE act.id = $1`,
      [actividadId],
    );
    return res.rows[0]?.operario_id ?? null;
  }

  async existeCentroTrabajo(centroTrabajoId: Id): Promise<boolean> {
    const res = await this.pool.query("SELECT 1 FROM centros_trabajo WHERE id = $1", [centroTrabajoId]);
    return (res.rowCount ?? 0) > 0;
  }
}
