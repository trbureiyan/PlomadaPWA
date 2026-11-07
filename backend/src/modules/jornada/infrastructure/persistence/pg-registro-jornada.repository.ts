import type pg from "pg";
import type { Fecha, Id, TipoRegistroJornada } from "@plomada/shared";
import { ZONA_NEGOCIO } from "../../../../compartido/tiempo";
import type { RegistroJornadaRepositoryPort } from "../../application/ports/registro-jornada-repository.port";
import type { RegistroJornadaEntidad } from "../../domain/registro-jornada";

export class PgRegistroJornadaRepository implements RegistroJornadaRepositoryPort {
  constructor(private readonly pool: pg.Pool) {}

  async guardar(registro: RegistroJornadaEntidad): Promise<void> {
    await this.pool.query(
      `INSERT INTO registros_jornada (id, operario_id, tipo, centro_trabajo_id, actividad_id, capturado_en, recibido_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        registro.id,
        registro.operarioId,
        registro.tipo,
        registro.centroTrabajoId ?? null,
        registro.actividadId ?? null,
        registro.capturadoEn,
        registro.recibidoEn,
      ],
    );
  }

  async buscarPorId(id: string): Promise<RegistroJornadaEntidad | null> {
    const res = await this.pool.query<{
      id: string;
      operario_id: string;
      tipo: TipoRegistroJornada;
      centro_trabajo_id: string | null;
      actividad_id: string | null;
      capturado_en: Date;
      recibido_en: Date;
    }>(
      `SELECT id, operario_id, tipo, centro_trabajo_id, actividad_id, capturado_en, recibido_en
       FROM registros_jornada WHERE id = $1`,
      [id],
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      operarioId: r.operario_id,
      tipo: r.tipo,
      centroTrabajoId: r.centro_trabajo_id ?? undefined,
      actividadId: r.actividad_id ?? undefined,
      capturadoEn: r.capturado_en.toISOString(),
      recibidoEn: r.recibido_en.toISOString(),
    };
  }

  async listar(filtro: {
    fecha: Fecha;
    operarioId?: Id;
  }): Promise<RegistroJornadaEntidad[]> {
    let sql = `
      SELECT id, operario_id, tipo, centro_trabajo_id, actividad_id, capturado_en, recibido_en
      FROM registros_jornada
      WHERE DATE(capturado_en AT TIME ZONE $1::text) = $2
    `;
    const params: unknown[] = [ZONA_NEGOCIO, filtro.fecha];

    if (filtro.operarioId) {
      sql += " AND operario_id = $3";
      params.push(filtro.operarioId);
    }
    sql += " ORDER BY capturado_en ASC";

    const res = await this.pool.query<{
      id: string;
      operario_id: string;
      tipo: TipoRegistroJornada;
      centro_trabajo_id: string | null;
      actividad_id: string | null;
      capturado_en: Date;
      recibido_en: Date;
    }>(sql, params);

    return res.rows.map((r) => ({
      id: r.id,
      operarioId: r.operario_id,
      tipo: r.tipo,
      centroTrabajoId: r.centro_trabajo_id ?? undefined,
      actividadId: r.actividad_id ?? undefined,
      capturadoEn: r.capturado_en.toISOString(),
      recibidoEn: r.recibido_en.toISOString(),
    }));
  }

  async listarPorActividadId(
    actividadId: string,
  ): Promise<RegistroJornadaEntidad[]> {
    const res = await this.pool.query<{
      id: string;
      operario_id: string;
      tipo: TipoRegistroJornada;
      centro_trabajo_id: string | null;
      actividad_id: string | null;
      capturado_en: Date;
      recibido_en: Date;
    }>(
      `SELECT id, operario_id, tipo, centro_trabajo_id, actividad_id, capturado_en, recibido_en
       FROM registros_jornada WHERE actividad_id = $1 ORDER BY capturado_en ASC`,
      [actividadId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      operarioId: r.operario_id,
      tipo: r.tipo,
      centroTrabajoId: r.centro_trabajo_id ?? undefined,
      actividadId: r.actividad_id ?? undefined,
      capturadoEn: r.capturado_en.toISOString(),
      recibidoEn: r.recibido_en.toISOString(),
    }));
  }

  async listarPorActividadesIds(
    actividadesIds: string[],
  ): Promise<Map<string, RegistroJornadaEntidad[]>> {
    const mapa = new Map<string, RegistroJornadaEntidad[]>();
    for (const id of actividadesIds) {
      mapa.set(id, []);
    }
    if (actividadesIds.length === 0) return mapa;

    const res = await this.pool.query<{
      id: string;
      operario_id: string;
      tipo: TipoRegistroJornada;
      centro_trabajo_id: string | null;
      actividad_id: string | null;
      capturado_en: Date;
      recibido_en: Date;
    }>(
      `SELECT id, operario_id, tipo, centro_trabajo_id, actividad_id, capturado_en, recibido_en
       FROM registros_jornada WHERE actividad_id = ANY($1) ORDER BY capturado_en ASC`,
      [actividadesIds],
    );

    for (const r of res.rows) {
      if (r.actividad_id) {
        mapa.get(r.actividad_id)?.push({
          id: r.id,
          operarioId: r.operario_id,
          tipo: r.tipo,
          centroTrabajoId: r.centro_trabajo_id ?? undefined,
          actividadId: r.actividad_id,
          capturadoEn: r.capturado_en.toISOString(),
          recibidoEn: r.recibido_en.toISOString(),
        });
      }
    }

    return mapa;
  }
}
