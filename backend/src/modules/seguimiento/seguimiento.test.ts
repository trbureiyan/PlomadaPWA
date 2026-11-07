import { afterEach, describe, expect, it, vi } from "vitest";
import type { Fecha } from "@plomada/shared";
import { ObtenerSeguimientoDiaUseCase } from "./application/obtener-seguimiento-dia.use-case";

describe("seguimiento del día", () => {
  afterEach(() => vi.useRealTimers());

  async function fechaPedida(ahora: string, filtro?: { fecha: Fecha }): Promise<Fecha> {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(ahora));
    let pedida = "";
    const casoDeUso = new ObtenerSeguimientoDiaUseCase({
      async obtenerSeguimiento(fecha) {
        pedida = fecha;
        return { fecha, generadoEn: ahora, operarios: [] };
      },
    });
    await casoDeUso.ejecutar(filtro);
    return pedida;
  }

  it("sin fecha, a las 20:00 de Bogotá pide el día de Bogotá y no el de UTC", async () => {
    expect(await fechaPedida("2026-11-04T01:00:00Z")).toBe("2026-11-03");
  });

  it("con fecha explícita no consulta el reloj", async () => {
    expect(await fechaPedida("2026-11-04T01:00:00Z", { fecha: "2026-10-01" })).toBe("2026-10-01");
  });
});
