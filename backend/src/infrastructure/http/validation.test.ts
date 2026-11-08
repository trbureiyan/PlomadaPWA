import type { Server } from "node:http";
import express from "express";
import { ErrorApi } from "@plomada/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { responderError } from "./validation";

// Hallazgo 9: una violación de clave foránea o de unicidad de PostgreSQL es un error
// del cliente que el contrato ya sabe nombrar; no debe terminar como error_interno.
const errorPg = (code: string, constraint: string) =>
  Object.assign(
    new Error(
      `violación de ${constraint}: Key (correo)=(x@y.z) already exists`,
    ),
    {
      code,
      constraint,
    },
  );

describe("responderError con errores de PostgreSQL", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.get("/fk", (_req, res) =>
      responderError(res, errorPg("23503", "programaciones_operario_fk")),
    );
    app.get("/unico", (_req, res) =>
      responderError(res, errorPg("23505", "usuarios_correo_key")),
    );
    app.get("/otro", (_req, res) =>
      responderError(res, errorPg("40001", "serializacion")),
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object")
          base = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.restoreAllMocks();
  });

  it("23503 (clave foránea) responde no_encontrado sin filtrar el detalle", async () => {
    const res = await fetch(`${base}/fk`);
    expect(res.status).toBe(404);
    const cuerpo = ErrorApi.parse(await res.json());
    expect(cuerpo.codigo).toBe("no_encontrado");
    expect(JSON.stringify(cuerpo)).not.toMatch(
      /programaciones_operario_fk|Key/,
    );
  });

  it("23505 (unicidad) responde conflicto sin filtrar el detalle", async () => {
    const res = await fetch(`${base}/unico`);
    expect(res.status).toBe(409);
    const cuerpo = ErrorApi.parse(await res.json());
    expect(cuerpo.codigo).toBe("conflicto");
    expect(JSON.stringify(cuerpo)).not.toMatch(/usuarios_correo_key|x@y\.z/);
  });

  it("cualquier otro código de PostgreSQL sigue siendo error_interno", async () => {
    const res = await fetch(`${base}/otro`);
    expect(res.status).toBe(500);
    expect(ErrorApi.parse(await res.json()).codigo).toBe("error_interno");
  });
});
