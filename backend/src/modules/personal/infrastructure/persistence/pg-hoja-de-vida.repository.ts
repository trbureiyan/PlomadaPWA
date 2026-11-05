import type pg from "pg";
import type { HojaDeVida } from "@plomada/shared";
import type { HojaDeVidaRepositoryPort } from "../../application/ports/hoja-de-vida-repository.port";

export class PgHojaDeVidaRepository implements HojaDeVidaRepositoryPort {
  constructor(private readonly pool: pg.Pool) {}

  async guardar(hoja: HojaDeVida): Promise<void> {
    await this.pool.query(
      `INSERT INTO hojas_de_vida (
         operario_id, nombre_completo, tipo_documento, numero_documento,
         telefono, cargo, fecha_ingreso, curso_alturas, vencimiento_alturas, formacion, experiencia, actualizado_en
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (operario_id) DO UPDATE SET
         nombre_completo = EXCLUDED.nombre_completo,
         tipo_documento = EXCLUDED.tipo_documento,
         numero_documento = EXCLUDED.numero_documento,
         telefono = EXCLUDED.telefono,
         cargo = EXCLUDED.cargo,
         fecha_ingreso = EXCLUDED.fecha_ingreso,
         curso_alturas = EXCLUDED.curso_alturas,
         vencimiento_alturas = EXCLUDED.vencimiento_alturas,
         formacion = EXCLUDED.formacion,
         experiencia = EXCLUDED.experiencia,
         actualizado_en = EXCLUDED.actualizado_en`,
      [
        hoja.operarioId,
        hoja.nombreCompleto,
        hoja.tipoDocumento,
        hoja.numeroDocumento,
        hoja.telefono ?? null,
        hoja.cargo,
        hoja.fechaIngreso,
        hoja.cursoAlturas ?? false,
        hoja.vencimientoAlturas ?? null,
        JSON.stringify(hoja.formacion),
        JSON.stringify(hoja.experiencia),
        new Date().toISOString(),
      ],
    );
  }

  async buscarPorOperarioId(operarioId: string): Promise<HojaDeVida | null> {
    const res = await this.pool.query<{
      operario_id: string;
      nombre_completo: string;
      tipo_documento: "CC" | "CE" | "otro";
      numero_documento: string;
      telefono: string | null;
      cargo: string;
      fecha_ingreso: string | Date;
      curso_alturas?: boolean | null;
      vencimiento_alturas?: string | Date | null;
      formacion: unknown;
      experiencia: unknown;
    }>("SELECT * FROM hojas_de_vida WHERE operario_id = $1", [operarioId]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const fechaIngresoStr =
      r.fecha_ingreso instanceof Date
        ? r.fecha_ingreso.toISOString().slice(0, 10)
        : String(r.fecha_ingreso).slice(0, 10);

    const vencimientoStr =
      r.vencimiento_alturas instanceof Date
        ? r.vencimiento_alturas.toISOString().slice(0, 10)
        : r.vencimiento_alturas
          ? String(r.vencimiento_alturas).slice(0, 10)
          : undefined;

    const parseArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed.map(String);
        } catch {
          return [];
        }
      }
      return [];
    };

    return {
      operarioId: r.operario_id,
      nombreCompleto: r.nombre_completo,
      tipoDocumento: r.tipo_documento,
      numeroDocumento: r.numero_documento,
      telefono: r.telefono ?? undefined,
      cargo: r.cargo,
      fechaIngreso: fechaIngresoStr,
      cursoAlturas: Boolean(r.curso_alturas),
      vencimientoAlturas: vencimientoStr,
      formacion: parseArray(r.formacion),
      experiencia: parseArray(r.experiencia),
    };
  }
}
