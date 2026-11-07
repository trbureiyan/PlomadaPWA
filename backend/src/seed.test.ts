import { afterEach, describe, expect, it, vi } from "vitest";
import { sembrarDatos } from "./seed";

describe("sembrarDatos", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("se niega a correr con NODE_ENV=production porque trunca todas las tablas", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(sembrarDatos("postgres://x:x@localhost:1/x")).rejects.toThrow(
      /production/,
    );
  });
});
