import type pg from "pg";
import type { EvidenciaRepositoryPort } from "../../application/ports/evidencia-repository.port";
import type { EvidenciaEntidad } from "../../domain/evidencia";

export class PgEvidenciaRepository implements EvidenciaRepositoryPort {
  constructor(private readonly pool: pg.Pool) {}

  async guardar(evidencia: EvidenciaEntidad): Promise<void> {
    await this.pool.query(
      `INSERT INTO evidencias (id, actividad_id, operario_id, tipo, capturada_en, recibida_en, tipo_mime, tamano_bytes, foto_ruta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        evidencia.id,
        evidencia.actividadId,
        evidencia.operarioId,
        evidencia.tipo,
        evidencia.capturadaEn,
        evidencia.recibidaEn,
        evidencia.tipoMime,
        evidencia.tamanoBytes,
        evidencia.fotoRuta,
      ],
    );
  }

  async buscarPorId(id: string): Promise<EvidenciaEntidad | null> {
    const res = await this.pool.query<{
      id: string;
      actividad_id: string;
      operario_id: string;
      tipo: "antes" | "durante" | "despues";
      capturada_en: Date;
      recibida_en: Date;
      tipo_mime: "image/jpeg" | "image/webp";
      tamano_bytes: number;
      foto_ruta: string;
    }>(
      `SELECT id, actividad_id, operario_id, tipo, capturada_en, recibida_en, tipo_mime, tamano_bytes, foto_ruta
       FROM evidencias WHERE id = $1`,
      [id],
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      actividadId: r.actividad_id,
      operarioId: r.operario_id,
      tipo: r.tipo,
      capturadaEn: r.capturada_en.toISOString(),
      recibidaEn: r.recibida_en.toISOString(),
      tipoMime: r.tipo_mime,
      tamanoBytes: r.tamano_bytes,
      fotoRuta: r.foto_ruta,
    };
  }

  async listarPorActividadId(actividadId: string): Promise<EvidenciaEntidad[]> {
    const res = await this.pool.query<{
      id: string;
      actividad_id: string;
      operario_id: string;
      tipo: "antes" | "durante" | "despues";
      capturada_en: Date;
      recibida_en: Date;
      tipo_mime: "image/jpeg" | "image/webp";
      tamano_bytes: number;
      foto_ruta: string;
    }>(
      `SELECT id, actividad_id, operario_id, tipo, capturada_en, recibida_en, tipo_mime, tamano_bytes, foto_ruta
       FROM evidencias WHERE actividad_id = $1 ORDER BY capturada_en ASC`,
      [actividadId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      actividadId: r.actividad_id,
      operarioId: r.operario_id,
      tipo: r.tipo,
      capturadaEn: r.capturada_en.toISOString(),
      recibidaEn: r.recibida_en.toISOString(),
      tipoMime: r.tipo_mime,
      tamanoBytes: r.tamano_bytes,
      fotoRuta: r.foto_ruta,
    }));
  }

  async listarPorActividadesIds(actividadesIds: string[]): Promise<Map<string, EvidenciaEntidad[]>> {
    const mapa = new Map<string, EvidenciaEntidad[]>();
    for (const id of actividadesIds) {
      mapa.set(id, []);
    }

    if (actividadesIds.length === 0) return mapa;

    const res = await this.pool.query<{
      id: string;
      actividad_id: string;
      operario_id: string;
      tipo: "antes" | "durante" | "despues";
      capturada_en: Date;
      recibida_en: Date;
      tipo_mime: "image/jpeg" | "image/webp";
      tamano_bytes: number;
      foto_ruta: string;
    }>(
      `SELECT id, actividad_id, operario_id, tipo, capturada_en, recibida_en, tipo_mime, tamano_bytes, foto_ruta
       FROM evidencias WHERE actividad_id = ANY($1) ORDER BY capturada_en ASC`,
      [actividadesIds],
    );

    for (const r of res.rows) {
      mapa.get(r.actividad_id)?.push({
        id: r.id,
        actividadId: r.actividad_id,
        operarioId: r.operario_id,
        tipo: r.tipo,
        capturadaEn: r.capturada_en.toISOString(),
        recibidaEn: r.recibida_en.toISOString(),
        tipoMime: r.tipo_mime,
        tamanoBytes: r.tamano_bytes,
        fotoRuta: r.foto_ruta,
      });
    }

    return mapa;
  }
}
