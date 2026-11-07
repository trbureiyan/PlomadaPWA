import { describe, expect, it } from "vitest";
import { leerSecretoJwt } from "./secreto-jwt";

const SECRETO_VALIDO = "a".repeat(32);

describe("leerSecretoJwt", () => {
  it("falla si falta el secreto fuera de test", () => {
    expect(() => leerSecretoJwt({ NODE_ENV: "production" })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => leerSecretoJwt({})).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("falla si el secreto tiene menos de 32 caracteres fuera de test", () => {
    expect(() =>
      leerSecretoJwt({ NODE_ENV: "production", JWT_ACCESS_SECRET: "a".repeat(31) }),
    ).toThrow(/32/);
  });

  it("acepta un secreto de 32 caracteres o más", () => {
    expect(leerSecretoJwt({ NODE_ENV: "production", JWT_ACCESS_SECRET: SECRETO_VALIDO })).toBe(
      SECRETO_VALIDO,
    );
  });

  it("en test usa un secreto propio si no hay variable", () => {
    expect(leerSecretoJwt({ NODE_ENV: "test" }).length).toBeGreaterThanOrEqual(32);
  });

  it("en test respeta la variable si existe", () => {
    expect(leerSecretoJwt({ NODE_ENV: "test", JWT_ACCESS_SECRET: SECRETO_VALIDO })).toBe(
      SECRETO_VALIDO,
    );
  });
});
