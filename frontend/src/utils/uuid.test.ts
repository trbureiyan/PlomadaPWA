import { describe, it, expect, vi } from "vitest";
import { generarUUIDSeguro } from "./uuid";

describe("generarUUIDSeguro", () => {
  const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("genera un UUID v4 con formato RFC 4122 válido", () => {
    const uuid = generarUUIDSeguro();
    expect(uuid).toMatch(UUID_V4_REGEX);
  });

  it("genera identificadores únicos en llamadas consecutivas", () => {
    const id1 = generarUUIDSeguro();
    const id2 = generarUUIDSeguro();
    expect(id1).not.toBe(id2);
  });

  it("usa el fallback RFC 4122 cuando crypto.randomUUID no está disponible (contexto HTTP móvil)", () => {
    // Simular contexto no seguro (HTTP) donde randomUUID no existe
    const originalCrypto = globalThis.crypto;
    try {
      // Reemplazar crypto por un objeto con getRandomValues pero sin randomUUID
      Object.defineProperty(globalThis, "crypto", {
        value: {
          getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
        },
        configurable: true,
        writable: true,
      });

      const fallbackUUID = generarUUIDSeguro();
      expect(fallbackUUID).toMatch(UUID_V4_REGEX);

      // Comprobar la unicidad con el fallback
      const fallbackUUID2 = generarUUIDSeguro();
      expect(fallbackUUID2).not.toBe(fallbackUUID);
      expect(fallbackUUID2).toMatch(UUID_V4_REGEX);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
    }
  });
});
