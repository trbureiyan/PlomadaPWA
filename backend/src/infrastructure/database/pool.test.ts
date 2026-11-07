import { afterEach, describe, expect, it, vi } from "vitest";
import { cerrarPool, obtenerPool } from "./pool";

describe("pool de conexiones", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await cerrarPool();
  });

  // Hallazgo 3: una conexión inactiva que se cae emite 'error' en el pool. Sin listener,
  // Node lo lanza como excepción no capturada y la API entera se detiene.
  it("un error de una conexión inactiva se registra y no tumba el proceso", () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = obtenerPool("postgres://plomada:plomada@127.0.0.1:1/plomada");

    expect(() => pool.emit("error", new Error("conexión cerrada por el servidor"))).not.toThrow();
    expect(registro).toHaveBeenCalledOnce();
  });
});
