import { describe, it, expect, afterEach, vi } from "vitest";
import { solicitarAlmacenamientoPersistente } from "./dexie-db";

describe("C-8: Pedir almacenamiento persistente (nota 011)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis.navigator, "storage", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("solicita persistencia con navigator.storage.persist() cuando aún no es persistente", async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    const persistedMock = vi.fn().mockResolvedValue(false);
    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});

    Object.defineProperty(globalThis.navigator, "storage", {
      value: {
        persist: persistMock,
        persisted: persistedMock,
      },
      configurable: true,
      writable: true,
    });

    const concedido = await solicitarAlmacenamientoPersistente();

    expect(persistedMock).toHaveBeenCalledOnce();
    expect(persistMock).toHaveBeenCalledOnce();
    expect(concedido).toBe(true);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[Storage] Almacenamiento persistente: concedido",
    );
  });

  it("no vuelve a solicitar persistencia si el almacenamiento ya es persistente", async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    const persistedMock = vi.fn().mockResolvedValue(true);

    Object.defineProperty(globalThis.navigator, "storage", {
      value: {
        persist: persistMock,
        persisted: persistedMock,
      },
      configurable: true,
      writable: true,
    });

    const resultado = await solicitarAlmacenamientoPersistente();

    expect(persistedMock).toHaveBeenCalledOnce();
    expect(persistMock).not.toHaveBeenCalled();
    expect(resultado).toBe(true);
  });

  it("continúa con total normalidad si el navegador deniega la persistencia (retorna false)", async () => {
    const persistMock = vi.fn().mockResolvedValue(false);
    const persistedMock = vi.fn().mockResolvedValue(false);
    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});

    Object.defineProperty(globalThis.navigator, "storage", {
      value: {
        persist: persistMock,
        persisted: persistedMock,
      },
      configurable: true,
      writable: true,
    });

    const concedido = await solicitarAlmacenamientoPersistente();

    expect(persistMock).toHaveBeenCalledOnce();
    expect(concedido).toBe(false);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[Storage] Almacenamiento persistente: denegado",
    );
  });

  it("tolera excepciones en persist() sin interrumpir ni lanzar error", async () => {
    const persistMock = vi
      .fn()
      .mockRejectedValue(new Error("Permiso denegado por política"));
    const persistedMock = vi.fn().mockResolvedValue(false);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    Object.defineProperty(globalThis.navigator, "storage", {
      value: {
        persist: persistMock,
        persisted: persistedMock,
      },
      configurable: true,
      writable: true,
    });

    let errorLanzado = false;
    try {
      const resultado = await solicitarAlmacenamientoPersistente();
      expect(resultado).toBe(false);
    } catch {
      errorLanzado = true;
    }

    expect(errorLanzado).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[Storage] No se pudo solicitar almacenamiento persistente:",
      expect.any(Error),
    );
  });

  it("retorna false pacíficamente si el entorno no dispone de la API navigator.storage", async () => {
    Object.defineProperty(globalThis.navigator, "storage", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const resultado = await solicitarAlmacenamientoPersistente();
    expect(resultado).toBe(false);
  });

  it("importar dexie-db no invoca navigator.storage.persist() de forma automática", async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    const persistedMock = vi.fn().mockResolvedValue(false);

    Object.defineProperty(globalThis.navigator, "storage", {
      value: {
        persist: persistMock,
        persisted: persistedMock,
      },
      configurable: true,
      writable: true,
    });

    vi.resetModules();
    const modulo = await import("./dexie-db");
    expect(modulo.db).toBeDefined();

    expect(persistMock).not.toHaveBeenCalled();
    expect(persistedMock).not.toHaveBeenCalled();
  });
});
