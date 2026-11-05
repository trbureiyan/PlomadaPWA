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

  it("Operario sube evidencia a la actividad sembrada sin error 422", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "operario1@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken } = (await loginRes.json()) as any;

    const evidenciaId = crypto.randomUUID();
    const actividadId = "50000000-0000-4000-8000-000000000001"; // ID sembrado

    const formData = new FormData();
    formData.append("actividadId", actividadId);
    formData.append("tipo", "antes");
    formData.append("capturadaEn", new Date().toISOString());
    const dummyBlob = new Blob([Buffer.from("fake-jpg-content")], { type: "image/jpeg" });
    formData.append("foto", dummyBlob, "evidencia.jpg");

    const res = await fetch(`${baseUrl}/evidencias/${evidenciaId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(201);
    const ev = (await res.json()) as any;
    expect(ev.id).toBe(evidenciaId);
    expect(ev.actividadId).toBe(actividadId);
    expect(ev.tipo).toBe("antes");
  });

  it("Operario registra jornada de entrada al centro sembrado e idempotencia", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "operario1@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken } = (await loginRes.json()) as any;

    const registroId = crypto.randomUUID();
    const centroTrabajoId = "20000000-0000-4000-8000-000000000001"; // Centro sembrado
    const payload = {
      tipo: "entrada_centro",
      centroTrabajoId,
      capturadoEn: new Date().toISOString(),
    };

    // Primera subida: 201 Created
    const res1 = await fetch(`${baseUrl}/registros-jornada/${registroId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(201);

    // Reintento con mismo ID (idempotencia): 200 OK
    const res2 = await fetch(`${baseUrl}/registros-jornada/${registroId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(200);
  });

  it("Supervisor abre actividad sembrada, descarga foto con auth y aprueba", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "supervisor@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken } = (await loginRes.json()) as any;
    const actividadId = "50000000-0000-4000-8000-000000000001";

    // 1. Obtener detalle de actividad sembrada
    const resDetalle = await fetch(`${baseUrl}/actividades/${actividadId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resDetalle.status).toBe(200);
    const detalle = (await resDetalle.json()) as any;
    expect(detalle.id).toBe(actividadId);
    expect(detalle.evidencias.length).toBeGreaterThan(0);

    // 2. Descargar la foto protegida con el token de supervisor
    const fotoEvidenciaId = detalle.evidencias[0].id;
    const resFoto = await fetch(`${baseUrl}/evidencias/${fotoEvidenciaId}/foto`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resFoto.status).toBe(200);
    expect(resFoto.headers.get("content-type")).toBe("image/jpeg");

    // 3. Revisar y aprobar
    const resRev = await fetch(`${baseUrl}/actividades/${actividadId}/revision`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        resultado: "aprobada",
      }),
    });
    expect(resRev.status).toBe(200);
  });

  it("Doble rotación de refresh tokens: segundo refresh funciona y token previo revocado da 401", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "operario1@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const loginData = (await loginRes.json()) as any;
    const tokenRefrescoOriginal = loginData.refreshToken;
    expect(tokenRefrescoOriginal).toBeDefined();

    // 1. Primer refresh
    const refresh1 = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenRefrescoOriginal }),
    });
    expect(refresh1.status).toBe(200);
    const data1 = (await refresh1.json()) as any;
    const tokenRefrescoRotado1 = data1.refreshToken;
    expect(tokenRefrescoRotado1).toBeDefined();
    expect(tokenRefrescoRotado1).not.toBe(tokenRefrescoOriginal);

    // 2. Intentar usar el token original revocado debe dar 401
    const intentoTokenViejo = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenRefrescoOriginal }),
    });
    expect(intentoTokenViejo.status).toBe(401);

    // 3. Segundo refresh con el token rotado: debe funcionar (200) y rotar de nuevo
    const refresh2 = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenRefrescoRotado1 }),
    });
    expect(refresh2.status).toBe(200);
    const data2 = (await refresh2.json()) as any;
    expect(data2.accessToken).toBeDefined();
    expect(data2.refreshToken).toBeDefined();
    expect(data2.refreshToken).not.toBe(tokenRefrescoRotado1);
  });

  it("Administrador gestiona usuarios y centros; operario recibe 403 en creación de usuarios", async () => {
    // 1. Login Administrador
    const adminLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "admin@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken: adminToken } = (await adminLogin.json()) as any;

    // 2. Administrador crea un nuevo operario (CU-11)
    const nuevoCorreo = `operario-nuevo-${Date.now()}@plomada.local`;
    const resCrearUsuario = await fetch(`${baseUrl}/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: "Operario Nuevo Prueba",
        correo: nuevoCorreo,
        rol: "operario",
        contrasenaInicial: "Plomada2026!",
      }),
    });
    expect(resCrearUsuario.status).toBe(201);
    const usuarioCreado = (await resCrearUsuario.json()) as any;
    expect(usuarioCreado.correo).toBe(nuevoCorreo);
    expect(usuarioCreado.rol).toBe("operario");

    // 3. Administrador crea un nuevo centro de trabajo (CU-12)
    const resCrearCentro = await fetch(`${baseUrl}/centros-trabajo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: "Conjunto Nueva Granada",
        direccion: "Calle 100 # 15-20, Bogotá",
      }),
    });
    expect(resCrearCentro.status).toBe(201);
    const centroCreado = (await resCrearCentro.json()) as any;
    expect(centroCreado.nombre).toBe("Conjunto Nueva Granada");

    // 4. Operario intenta crear usuario y recibe 403 sin_permiso
    const opLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "operario1@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken: opToken } = (await opLogin.json()) as any;

    const resForbidden = await fetch(`${baseUrl}/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opToken}`,
      },
      body: JSON.stringify({
        nombre: "Intruso",
        correo: `hacker-${Date.now()}@plomada.local`,
        rol: "administrador",
        contrasenaInicial: "Plomada2026!",
      }),
    });
    expect(resForbidden.status).toBe(403);
  });
});
