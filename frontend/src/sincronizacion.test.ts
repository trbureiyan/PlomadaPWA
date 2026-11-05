import { describe, it, expect } from "vitest";
import { LIMITES_EVIDENCIA, type TipoRegistroJornada } from "@plomada/shared";

describe("Frontend Client Logic", () => {
  it("respeta límites de evidencia del contrato", () => {
    expect(LIMITES_EVIDENCIA.ladoMayorMaximoPx).toBe(1600);
    expect(LIMITES_EVIDENCIA.tamanoMaximoBytes).toBe(1_500_000);
    expect(LIMITES_EVIDENCIA.campoArchivo).toBe("foto");
  });

  it("genera UUIDs únicos para registros offline", () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
