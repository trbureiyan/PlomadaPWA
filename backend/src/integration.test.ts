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

  it("Administrativo gestiona centros y hojas de vida, pero recibe 403 al crear usuarios", async () => {
    // 1. Login Administrativo
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "administrativo@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    expect(adminRes.status).toBe(200);
    const { accessToken: admToken } = (await adminRes.json()) as any;

    // 2. Administrativo crea centro de trabajo (CU-12)
    const resCentro = await fetch(`${baseUrl}/centros-trabajo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admToken}`,
      },
      body: JSON.stringify({
        nombre: "Conjunto Residencial El Pinar",
        direccion: "Avenida 19 # 134-50, Bogotá",
      }),
    });
    expect(resCentro.status).toBe(201);
    const centro = (await resCentro.json()) as any;
    expect(centro.nombre).toBe("Conjunto Residencial El Pinar");

    // 3. Administrativo guarda hoja de vida de operario (CU-13)
    const operarioId = "10000000-0000-4000-8000-000000000004";
    const resHoja = await fetch(`${baseUrl}/operarios/${operarioId}/hoja-de-vida`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admToken}`,
      },
      body: JSON.stringify({
        nombreCompleto: "Juan Carlos Pérez",
        tipoDocumento: "CC",
        numeroDocumento: "1018273645",
        telefono: "3109876543",
        cargo: "Operario de Mantenimiento",
        fechaIngreso: "2024-01-15",
        formacion: ["Certificado Trabajo en Alturas", "Curso de Primeros Auxilios"],
        experiencia: ["3 años en mantenimiento locativo"],
      }),
    });
    expect(resHoja.status).toBe(200);
    const hoja = (await resHoja.json()) as any;
    expect(hoja.numeroDocumento).toBe("1018273645");

    // 4. Administrativo consulta hoja de vida guardada
    const resConsultaHoja = await fetch(`${baseUrl}/operarios/${operarioId}/hoja-de-vida`, {
      headers: { Authorization: `Bearer ${admToken}` },
    });
    expect(resConsultaHoja.status).toBe(200);
    const hojaConsultada = (await resConsultaHoja.json()) as any;
    expect(hojaConsultada.cargo).toBe("Operario de Mantenimiento");

    // 5. Administrativo intenta crear usuario en el sistema -> 403 (exclusivo de Administrador)
    const resIntentoUsuario = await fetch(`${baseUrl}/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admToken}`,
      },
      body: JSON.stringify({
        nombre: "Nuevo Usuario Ilegal",
        correo: `no-permitido-${Date.now()}@plomada.local`,
        rol: "operario",
        contrasenaInicial: "Plomada2026!",
      }),
    });
    expect(resIntentoUsuario.status).toBe(403);
  });

  it("Administrador: valida obligatoriedad de correo institucional @plomada.local para operarios y contraseña mínima", async () => {
    // Login Administrador
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "admin@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    expect(adminRes.status).toBe(200);
    const { accessToken: adminToken } = (await adminRes.json()) as any;

    // 1. Intento con correo externo (@gmail.com) para rol operario -> 422
    const resCorreoExterno = await fetch(`${baseUrl}/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: "Operario Gmail",
        correo: `externo-${Date.now()}@gmail.com`,
        rol: "operario",
        contrasenaInicial: "Plomada2026!",
      }),
    });
    expect(resCorreoExterno.status).toBe(422);
    const errCorreo = (await resCorreoExterno.json()) as any;
    expect(errCorreo.codigo).toBe("validacion");

    // 2. Intento con contraseña vacía o demasiado corta -> 422
    const resSinPassword = await fetch(`${baseUrl}/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: "Operario Sin Clave",
        correo: `valido-${Date.now()}@plomada.local`,
        rol: "operario",
        contrasenaInicial: "corta",
      }),
    });
    expect(resSinPassword.status).toBe(422);

    // 3. Creación exitosa de operario con correo @plomada.local y contraseña válida
    const nuevoCorreo = `operario-test-${Date.now()}@plomada.local`;
    const resExito = await fetch(`${baseUrl}/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: "Operario Calificado",
        correo: nuevoCorreo,
        rol: "operario",
        contrasenaInicial: "Plomada2026!",
      }),
    });
    expect(resExito.status).toBe(201);
    const creado = (await resExito.json()) as any;
    expect(creado.correo).toBe(nuevoCorreo);
    expect(creado.rol).toBe("operario");
  });

  it("Personal: Hoja de vida persiste y recupera certificación de trabajo en alturas (CU-13)", async () => {
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "admin@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken: adminToken } = (await adminRes.json()) as any;
    const operarioId = "10000000-0000-4000-8000-000000000005";

    // Guardar hoja de vida con curso de alturas y fecha de vencimiento
    const resGuardar = await fetch(`${baseUrl}/operarios/${operarioId}/hoja-de-vida`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombreCompleto: "Andrés Felipe Gómez",
        tipoDocumento: "CC",
        numeroDocumento: "1098765432",
        telefono: "3201112233",
        cargo: "Especialista en Fachadas",
        fechaIngreso: "2023-05-10",
        cursoAlturas: true,
        vencimientoAlturas: "2027-12-31",
        formacion: ["Trabajo Seguro en Alturas Nivel Avanzado"],
        experiencia: ["5 años mantenimiento en alturas"],
      }),
    });
    expect(resGuardar.status).toBe(200);
    const guardado = (await resGuardar.json()) as any;
    expect(guardado.cursoAlturas).toBe(true);
    expect(guardado.vencimientoAlturas).toBe("2027-12-31");

    // Consultar hoja de vida persistida
    const resConsultar = await fetch(`${baseUrl}/operarios/${operarioId}/hoja-de-vida`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(resConsultar.status).toBe(200);
    const consultado = (await resConsultar.json()) as any;
    expect(consultado.cursoAlturas).toBe(true);
    expect(consultado.vencimientoAlturas).toBe("2027-12-31");
  });

  it("Programación: Creación y conflicto 409 cuando la semana ya existe", async () => {
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "administrativo@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken: admToken } = (await adminRes.json()) as any;
    const semanaActual = obtenerLunesSemanaActual();

    // La semana actual ya fue sembrada en seed.ts -> debe rechazar con 409 [conflicto]
    const resConflicto = await fetch(`${baseUrl}/programaciones`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admToken}`,
      },
      body: JSON.stringify({
        semanaInicio: semanaActual,
        asignaciones: [
          {
            operarioId: "10000000-0000-4000-8000-000000000004",
            centroTrabajoId: "20000000-0000-4000-8000-000000000001",
            fecha: semanaActual,
            actividades: [{ descripcion: "Revisión técnica de prueba" }],
          },
        ],
      }),
    });
    expect(resConflicto.status).toBe(409);
    const errConflicto = (await resConflicto.json()) as any;
    expect(errConflicto.codigo).toBe("conflicto");
  });

  it("Operario consulta mi-programacion sin parámetro y resuelve su semana publicada automáticamente", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "operario1@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    expect(loginRes.status).toBe(200);
    const { accessToken } = (await loginRes.json()) as any;

    // Consulta sin semanaInicio especificada
    const resSinParam = await fetch(`${baseUrl}/mi-programacion`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resSinParam.status).toBe(200);
    const data = (await resSinParam.json()) as any;
    expect(data.semanaInicio).toBeDefined();
    expect(Array.isArray(data.asignaciones)).toBe(true);
    expect(data.asignaciones.length).toBeGreaterThan(0);
    // Cada asignación debe pertenecer al operario autenticado
    for (const a of data.asignaciones) {
      expect(a.operarioId).toBe("10000000-0000-4000-8000-000000000004");
    }
  });

  it("Administrador recibe 409 conflicto al intentar registrar un correo duplicado", async () => {
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "admin@plomada.local",
        contrasena: "Plomada2026!",
      }),
    });
    const { accessToken: adminToken } = (await adminRes.json()) as any;

    // Intento crear un usuario con el correo ya existente de operario1
    const resDuplicado = await fetch(`${baseUrl}/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: "Operario Repetido",
        correo: "operario1@plomada.local",
        rol: "operario",
        contrasenaInicial: "Plomada2026!",
      }),
    });
    expect(resDuplicado.status).toBe(409);
    const err = (await resDuplicado.json()) as any;
    expect(err.codigo).toBe("conflicto");
  });
});
