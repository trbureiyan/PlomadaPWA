// EC-03: cada regla de rol tiene una prueba automatizada. La lista de rutas y de roles
// permitidos sale del registro `rutas` de `shared`, que es el contrato; si se agrega una
// ruta restringida, esta prueba la recorre sin tocarla.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "http";
import type pg from "pg";
import {
  ErrorApi,
  ROLES,
  SesionRespuesta,
  rutas,
  type DefinicionRuta,
  type Rol,
} from "@plomada/shared";

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ??
  "secreto-desarrollo-plomada-2026-min-32-chars";

import { crearApp } from "./composition-root";
import { sembrarDatos } from "./seed";

const CORREO_POR_ROL: Record<Rol, string> = {
  administrador: "admin@plomada.local",
  administrativo: "administrativo@plomada.local",
  supervisor: "supervisor@plomada.local",
  operario: "operario1@plomada.local",
};

const ID_INEXISTENTE = "99999999-9999-4999-8999-999999999999";

const catalogo: Array<[string, DefinicionRuta]> = Object.entries(rutas);

// Rutas con una lista de roles, con la lista ya estrechada para que TypeScript la conozca.
const restringidas: Array<[string, DefinicionRuta, readonly Rol[]]> = [];
const autenticadas: Array<[string, DefinicionRuta]> = [];
for (const [nombre, ruta] of catalogo) {
  if (Array.isArray(ruta.acceso)) {
    restringidas.push([nombre, ruta, ruta.acceso]);
  } else if (ruta.acceso === "autenticado") {
    autenticadas.push([nombre, ruta]);
  }
}

describe("matriz de roles del contrato HTTP (EC-03)", () => {
  let server: Server;
  let pool: pg.Pool;
  let base: string;
  const tokens = {} as Record<Rol, string>;

  beforeAll(async () => {
    await sembrarDatos();
    const res = crearApp();
    pool = res.pool;
    await new Promise<void>((resolve) => {
      server = res.app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object")
          base = `http://localhost:${addr.port}/api/v1`;
        resolve();
      });
    });
    for (const rol of ROLES) {
      const respuesta = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: CORREO_POR_ROL[rol],
          contrasena: "Plomada2026!",
        }),
      });
      tokens[rol] = SesionRespuesta.parse(await respuesta.json()).accessToken;
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  function pedir(ruta: DefinicionRuta, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const init: RequestInit = { method: ruta.metodo, headers };
    if (ruta.metodo !== "GET") {
      headers["Content-Type"] = "application/json";
      init.body = "{}";
    }
    return fetch(`${base}${ruta.ruta.replace(/:id/g, ID_INEXISTENTE)}`, init);
  }

  it("el contrato tiene rutas restringidas que recorrer", () => {
    expect(restringidas.length).toBeGreaterThan(10);
    expect(ROLES).toHaveLength(4);
  });

  for (const [nombre, ruta] of [
    ...restringidas.map(([n, r]): [string, DefinicionRuta] => [n, r]),
    ...autenticadas,
  ]) {
    it(`${nombre}: sin token responde 401 no_autenticado`, async () => {
      const res = await pedir(ruta);
      expect(res.status).toBe(401);
      expect(ErrorApi.parse(await res.json()).codigo).toBe("no_autenticado");
    });
  }

  for (const [nombre, ruta, permitidos] of restringidas) {
    describe(nombre, () => {
      for (const rol of ROLES.filter((r) => !permitidos.includes(r))) {
        it(`el rol ${rol} recibe 403 sin_permiso`, async () => {
          const res = await pedir(ruta, tokens[rol]);
          expect(res.status).toBe(403);
          expect(ErrorApi.parse(await res.json()).codigo).toBe("sin_permiso");
        });
      }

      for (const rol of permitidos) {
        it(`el rol ${rol} pasa el control de rol (no recibe 401)`, async () => {
          const res = await pedir(ruta, tokens[rol]);
          // Puede responder 404, 422 u otro: se pidió a propósito con un id y un cuerpo vacíos.
          // La propiedad del recurso (403 desde un caso de uso) se prueba en contrato-http.
          expect(res.status).not.toBe(401);
          expect(res.status).toBeLessThan(500);
        });
      }
    });
  }
});
