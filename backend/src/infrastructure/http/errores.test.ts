import type { Server } from "node:http";
import express from "express";
import { ErrorApi } from "@plomada/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { manejadorErrores, rutaNoEncontrada } from "./errores";

describe("manejadores de error", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.use(express.json({ limit: "1kb" }));
    app.post("/eco", (req, res) => {
      res.json(req.body);
    });
    app.get("/falla", () => {
      throw new Error("detalle interno: password=hunter2");
    });
    app.use(rutaNoEncontrada);
    app.use(manejadorErrores);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") base = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.restoreAllMocks();
  });

  async function esperarError(res: Response, status: number, codigo: string) {
    expect(res.status).toBe(status);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const cuerpo = ErrorApi.parse(await res.json());
    expect(cuerpo.codigo).toBe(codigo);
    return cuerpo;
  }

  it("JSON malformado responde validacion en JSON", async () => {
    const res = await fetch(`${base}/eco`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"correo":',
    });
    await esperarError(res, 422, "validacion");
  });

  it("cuerpo que excede el límite responde validacion en JSON", async () => {
    const res = await fetch(`${base}/eco`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relleno: "x".repeat(5000) }),
    });
    await esperarError(res, 422, "validacion");
  });

  it("ruta desconocida responde no_encontrado en JSON", async () => {
    await esperarError(await fetch(`${base}/no-existe`), 404, "no_encontrado");
  });

  it("un error no previsto responde error_interno sin filtrar el mensaje", async () => {
    const res = await fetch(`${base}/falla`);
    const cuerpo = await esperarError(res, 500, "error_interno");
    expect(JSON.stringify(cuerpo)).not.toMatch(/hunter2|detalle interno/);
  });
});
