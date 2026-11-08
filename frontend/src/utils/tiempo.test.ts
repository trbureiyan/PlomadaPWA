import { describe, expect, it } from "vitest";
import { hoyEnNegocio } from "./tiempo";

describe("hoyEnNegocio", () => {
  it("a las 20:00 de Bogotá el día es el de Bogotá y no el siguiente de UTC", () => {
    // 2026-11-07T01:00Z son las 20:00 del 6 de noviembre en Bogotá (UTC-5).
    expect(hoyEnNegocio(new Date("2026-11-07T01:00:00Z"))).toBe("2026-11-06");
  });

  it("el día cambia a las 05:00Z, que es la medianoche de Bogotá", () => {
    expect(hoyEnNegocio(new Date("2026-11-07T04:59:59Z"))).toBe("2026-11-06");
    expect(hoyEnNegocio(new Date("2026-11-07T05:00:00Z"))).toBe("2026-11-07");
  });
});
