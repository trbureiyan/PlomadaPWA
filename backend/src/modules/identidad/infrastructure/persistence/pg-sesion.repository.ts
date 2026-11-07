import type pg from "pg";
import type { SesionRepositoryPort } from "../../application/ports/sesion-repository.port";
import type { Sesion } from "../../domain/sesion";

export class PgSesionRepository implements SesionRepositoryPort {
  constructor(private readonly pool: pg.Pool) {}

  async guardar(sesion: Sesion): Promise<void> {
    await this.pool.query(
      `INSERT INTO sesiones (id, usuario_id, token_refresco_hash, expira_en, revocado_en, creado_en)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sesion.id,
        sesion.usuarioId,
        sesion.tokenRefrescoHash,
        sesion.expiraEn,
        sesion.revocadoEn ?? null,
        sesion.creadoEn,
      ],
    );
  }

  async buscarPorTokenHash(tokenHash: string): Promise<Sesion | null> {
    const res = await this.pool.query<{
      id: string;
      usuario_id: string;
      token_refresco_hash: string;
      expira_en: Date;
      revocado_en: Date | null;
      creado_en: Date;
    }>(
      "SELECT id, usuario_id, token_refresco_hash, expira_en, revocado_en, creado_en FROM sesiones WHERE token_refresco_hash = $1",
      [tokenHash],
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      usuarioId: r.usuario_id,
      tokenRefrescoHash: r.token_refresco_hash,
      expiraEn: r.expira_en,
      revocadoEn: r.revocado_en,
      creadoEn: r.creado_en,
    };
  }

  // Condicional a nivel de SQL: la base decide quién gana cuando dos refrescos llegan a la vez.
  async revocar(id: string, revocadoEn: Date): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE sesiones SET revocado_en = $1 WHERE id = $2 AND revocado_en IS NULL RETURNING id",
      [revocadoEn, id],
    );
    return res.rows.length === 1;
  }
}
