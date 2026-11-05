import type pg from "pg";
import type { ResultadoRevision } from "@plomada/shared";
import type { RevisionRepositoryPort } from "../../application/ports/revision-repository.port";
import type { RevisionEntidad } from "../../domain/revision";

export class PgRevisionRepository implements RevisionRepositoryPort {
  constructor(private readonly pool: pg.Pool) {}

  async guardar(revision: RevisionEntidad): Promise<void> {
    await this.pool.query(
      `INSERT INTO revisiones (actividad_id, supervisor_id, resultado, observacion, revisada_en)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (actividad_id) DO UPDATE SET
         supervisor_id = EXCLUDED.supervisor_id,
         resultado = EXCLUDED.resultado,
         observacion = EXCLUDED.observacion,
         revisada_en = EXCLUDED.revisada_en`,
      [
        revision.actividadId,
        revision.supervisorId,
        revision.resultado,
        revision.observacion ?? null,
        revision.revisadaEn,
      ],
    );
  }

  async buscarPorActividadId(actividadId: string): Promise<RevisionEntidad | null> {
    const res = await this.pool.query<{
      actividad_id: string;
      supervisor_id: string;
      resultado: ResultadoRevision;
      observacion: string | null;
      revisada_en: Date;
    }>(
      `SELECT actividad_id, supervisor_id, resultado, observacion, revisada_en
       FROM revisiones WHERE actividad_id = $1`,
      [actividadId],
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      actividadId: r.actividad_id,
      supervisorId: r.supervisor_id,
      resultado: r.resultado,
      observacion: r.observacion ?? undefined,
      revisadaEn: r.revisada_en.toISOString(),
    };
  }

  async buscarPorActividadesIds(actividadesIds: string[]): Promise<Map<string, RevisionEntidad>> {
    const mapa = new Map<string, RevisionEntidad>();
    if (actividadesIds.length === 0) return mapa;

    const res = await this.pool.query<{
      actividad_id: string;
      supervisor_id: string;
      resultado: ResultadoRevision;
      observacion: string | null;
      revisada_en: Date;
    }>(
      `SELECT actividad_id, supervisor_id, resultado, observacion, revisada_en
       FROM revisiones WHERE actividad_id = ANY($1)`,
      [actividadesIds],
    );

    for (const r of res.rows) {
      mapa.set(r.actividad_id, {
        actividadId: r.actividad_id,
        supervisorId: r.supervisor_id,
        resultado: r.resultado,
        observacion: r.observacion ?? undefined,
        revisadaEn: r.revisada_en.toISOString(),
      });
    }

    return mapa;
  }
}
