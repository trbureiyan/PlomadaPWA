import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import type pg from "pg";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // Si no encuentra .env usa default
  }
}
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://plomada:plomada@localhost:5433/plomada";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "secreto-desarrollo-plomada-2026-min-32-chars";

import { crearApp } from "./composition-root";
import { obtenerLunesSemanaActual } from "./seed";

describe("Integración HTTP con base de datos real", () => {
  let server: Server;
  let pool: pg.Pool;
  let baseUrl: string;

  beforeAll(async () => {
    const res = crearApp();
    pool = res.pool;
    await new Promise<void>((resolve) => {
      server = res.app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://localhost:${addr.port}/api/v1`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (pool) {
      await pool.end();
    }
  });

  it("GET /salud responde 200 ok", async () => {
    const res = await fetch(`${baseUrl}/salud`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.estado).toBe("ok");
  });

  it("POST /auth/login autentica al operario correctamente", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "operario1@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.usuario.correo).toBe("operario1@plomada.local");
    expect(data.usuario.rol).toBe("operario");
    expect(data.accessToken).toBeDefined();

    // Probar GET /auth/me con el token obtenido
    const resMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    expect(resMe.status).toBe(200);
    const me = (await resMe.json()) as any;
    expect(me.correo).toBe("operario1@plomada.local");
  });

  it("GET /mi-programacion devuelve la programación del operario autenticado", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "operario1@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken } = (await loginRes.json()) as any;
    const semanaInicio = obtenerLunesSemanaActual();

    const res = await fetch(`${baseUrl}/mi-programacion?semanaInicio=${semanaInicio}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.semanaInicio).toBe(semanaInicio);
    expect(Array.isArray(data.asignaciones)).toBe(true);
    expect(data.asignaciones.length).toBeGreaterThan(0);
  });

  it("Supervisor consulta actividades", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "supervisor@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken } = (await loginRes.json()) as any;

    const res = await fetch(`${baseUrl}/actividades`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const list = (await res.json()) as any[];
    expect(Array.isArray(list)).toBe(true);
  });
});
