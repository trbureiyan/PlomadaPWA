import { describe, expect, it } from "vitest";
import { diaDeNegocio, esMismoInstante, hoyEnNegocio, lunesDeLaSemanaActual } from "./tiempo";

// Bogotá es UTC-5 todo el año (sin horario de verano): 20:00 allá son las 01:00Z del día siguiente.
describe("tiempo de negocio (America/Bogota)", () => {
  it("a las 20:00 de Bogotá el día es el de Bogotá, no el de UTC", () => {
    expect(hoyEnNegocio(new Date("2026-11-04T01:00:00Z"))).toBe("2026-11-03");
  });

  it("el día cambia a las 00:00 de Bogotá, que son las 05:00Z", () => {
    expect(hoyEnNegocio(new Date("2026-11-04T04:59:59Z"))).toBe("2026-11-03");
    expect(hoyEnNegocio(new Date("2026-11-04T05:00:00Z"))).toBe("2026-11-04");
  });

  it("el domingo por la noche sigue en la semana que termina", () => {
    // Domingo 8 de noviembre, 20:00 en Bogotá = lunes 9 a las 01:00Z.
    expect(lunesDeLaSemanaActual(new Date("2026-11-09T01:00:00Z"))).toBe("2026-11-02");
    expect(lunesDeLaSemanaActual(new Date("2026-11-09T05:00:00Z"))).toBe("2026-11-09");
  });

  it("de lunes a sábado la semana empieza en el lunes anterior", () => {
    expect(lunesDeLaSemanaActual(new Date("2026-11-02T15:00:00Z"))).toBe("2026-11-02");
    expect(lunesDeLaSemanaActual(new Date("2026-11-07T15:00:00Z"))).toBe("2026-11-02");
  });

  it("el día de un instante guardado en UTC es el día de Bogotá", () => {
    expect(diaDeNegocio("2026-11-04T00:30:00.000Z")).toBe("2026-11-03");
    expect(diaDeNegocio("2026-11-03T14:00:00Z")).toBe("2026-11-03");
  });

  it("dos escrituras del mismo instante son iguales aunque difieran los milisegundos", () => {
    expect(esMismoInstante("2026-11-04T13:05:00Z", "2026-11-04T13:05:00.000Z")).toBe(true);
    expect(esMismoInstante("2026-11-04T13:05:00Z", "2026-11-04T13:05:01Z")).toBe(false);
  });
});
