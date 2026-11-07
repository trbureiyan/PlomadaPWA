import type pg from "pg";
import type { Id } from "@plomada/shared";
import type {
  ActividadProgramada,
  ConsultaProgramacionPort,
  FiltroActividades,
} from "../../application/ports/consulta-programacion.port";

interface FilaActividad {
  id: string;
  descripcion: string;
  operario_id: string;
  centro_trabajo_id: string;
  centro_trabajo_nombre: string;
  centro_trabajo_direccion: string | null;
  fecha: string;
}

const SELECT_ACTIVIDAD = `
  SELECT act.id, act.descripcion, asig.operario_id, asig.centro_trabajo_id,
         c.nombre AS centro_trabajo_nombre, c.direccion AS centro_trabajo_direccion,
         asig.fecha::text AS fecha
    FROM actividades act
    JOIN asignaciones asig ON asig.id = act.asignacion_id
    JOIN centros_trabajo c ON c.id = asig.centro_trabajo_id
    JOIN programaciones_semanales p ON p.id = asig.programacion_id`;

function aActividad(r: FilaActividad): ActividadProgramada {
  return {
    id: r.id,
    descripcion: r.descripcion,
    operarioId: r.operario_id,
    centroTrabajoId: r.centro_trabajo_id,
    centroTrabajoNombre: r.centro_trabajo_nombre,
    centroTrabajoDireccion: r.centro_trabajo_direccion ?? undefined,
    fecha: r.fecha,
  };
}

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

  async buscarActividad(actividadId: Id): Promise<ActividadProgramada | null> {
    const res = await this.pool.query<FilaActividad>(`${SELECT_ACTIVIDAD} WHERE act.id = $1`, [actividadId]);
    return res.rows[0] ? aActividad(res.rows[0]) : null;
  }

  async listarActividades(filtro: FiltroActividades = {}): Promise<ActividadProgramada[]> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtro.fecha) {
      params.push(filtro.fecha);
      condiciones.push(`asig.fecha = $${params.length}`);
    }
    if (filtro.centroTrabajoId) {
      params.push(filtro.centroTrabajoId);
      condiciones.push(`asig.centro_trabajo_id = $${params.length}`);
    }
    if (filtro.soloPublicadas) condiciones.push("p.estado = 'publicada'");
    const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(" AND ")}` : "";
    const res = await this.pool.query<FilaActividad>(
      `${SELECT_ACTIVIDAD}${where} ORDER BY asig.fecha ASC, c.nombre ASC, act.descripcion ASC`,
      params,
    );
    return res.rows.map(aActividad);
  }
}
