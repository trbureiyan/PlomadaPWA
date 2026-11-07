// Criterios B3, B5 y B7 del plan de trabajo: cada regla de acceso y de
// idempotencia tiene su prueba, y las respuestas se validan con los esquemas
// de `shared`, que son el contrato; no con aserciones sueltas.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "http";
import type pg from "pg";
import {
  ActividadDetalle,
  ActividadResumen,
  CentroTrabajo,
  ErrorApi,
  Evidencia,
  MiProgramacion,
  RegistroJornada,
  Revision,
  SesionRespuesta,
  Usuario,
} from "@plomada/shared";
import { z } from "zod";

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ??
  "secreto-desarrollo-plomada-2026-min-32-chars";

import { crearApp } from "./composition-root";
import { obtenerLunesSemanaActual, sembrarDatos, sumarDias } from "./seed";

const ACTIVIDAD_DE_OPERARIO1 = "50000000-0000-4000-8000-000000000002";
const ACTIVIDAD_SIN_EVIDENCIA = "50000000-0000-4000-8000-000000000006";
const CENTRO = "20000000-0000-4000-8000-000000000001";

describe("Contrato HTTP validado con shared", () => {
  let server: Server;
  let pool: pg.Pool;
  let base: string;

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
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  async function login(correo: string) {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, contrasena: "Plomada2026!" }),
    });
    expect(res.status).toBe(200);
    return SesionRespuesta.parse(await res.json());
  }

  async function esError(res: Response, status: number, codigo: string) {
    expect(res.status).toBe(status);
    expect(ErrorApi.parse(await res.json()).codigo).toBe(codigo);
  }

  const jpeg = (relleno: string) =>
    Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from(relleno)]);

  function formularioFoto(tipo: string, bytes: Buffer, mime = "image/jpeg") {
    const form = new FormData();
    form.append("actividadId", ACTIVIDAD_DE_OPERARIO1);
    form.append("tipo", tipo);
    form.append("capturadaEn", "2026-11-03T09:00:00.000Z");
    form.append(
      "foto",
      new Blob([new Uint8Array(bytes)], { type: mime }),
      "foto",
    );
    return form;
  }

  describe("autenticación y roles (B3)", () => {
    it("login responde lo que define SesionRespuesta", async () => {
      const sesion = await login("operario1@plomada.local");
      expect(sesion.usuario.rol).toBe("operario");
    });

    it("login con contraseña errónea responde no_autenticado", async () => {
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: "operario1@plomada.local",
          contrasena: "incorrecta",
        }),
      });
      await esError(res, 401, "no_autenticado");
    });

    it("ruta protegida sin token responde no_autenticado", async () => {
      await esError(await fetch(`${base}/auth/me`), 401, "no_autenticado");
      await esError(await fetch(`${base}/actividades`), 401, "no_autenticado");
    });

    it("token inválido responde no_autenticado", async () => {
      const res = await fetch(`${base}/auth/me`, {
        headers: { Authorization: "Bearer basura" },
      });
      await esError(res, 401, "no_autenticado");
    });

    it("rol equivocado responde sin_permiso", async () => {
      const { accessToken: operario } = await login("operario1@plomada.local");
      const { accessToken: supervisor } = await login(
        "supervisor@plomada.local",
      );
      const cabecera = (t: string) => ({ Authorization: `Bearer ${t}` });

      await esError(
        await fetch(`${base}/actividades`, { headers: cabecera(operario) }),
        403,
        "sin_permiso",
      );
      await esError(
        await fetch(`${base}/programaciones`, {
          headers: cabecera(supervisor),
        }),
        403,
        "sin_permiso",
      );
      await esError(
        await fetch(
          `${base}/mi-programacion?semanaInicio=${obtenerLunesSemanaActual()}`,
          {
            headers: cabecera(supervisor),
          },
        ),
        403,
        "sin_permiso",
      );
    });

    it("renovar la sesión devuelve otra SesionRespuesta e invalida el refresh anterior", async () => {
      const inicial = await login("operario2@plomada.local");
      const renovar = (refreshToken: string) =>
        fetch(`${base}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

      const res = await renovar(inicial.refreshToken);
      expect(res.status).toBe(200);
      const nueva = SesionRespuesta.parse(await res.json());
      expect(nueva.refreshToken).not.toBe(inicial.refreshToken);

      await esError(await renovar(inicial.refreshToken), 401, "no_autenticado");
    });
  });

  describe("lecturas validadas contra shared (B7)", () => {
    it("GET /auth/me", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const res = await fetch(`${base}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      Usuario.parse(await res.json());
    });

    it("GET /mi-programacion", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const res = await fetch(
        `${base}/mi-programacion?semanaInicio=${obtenerLunesSemanaActual()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      expect(res.status).toBe(200);
      const programacion = MiProgramacion.parse(await res.json());
      expect(programacion.asignaciones.length).toBeGreaterThan(0);
    });

    it("GET /centros-trabajo", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const res = await fetch(`${base}/centros-trabajo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      expect(
        z
          .array(CentroTrabajo)
          .min(1)
          .parse(await res.json()).length,
      ).toBeGreaterThan(0);
    });

    it("GET /actividades y GET /actividades/:id", async () => {
      const { accessToken } = await login("supervisor@plomada.local");
      const headers = { Authorization: `Bearer ${accessToken}` };

      const lista = await fetch(`${base}/actividades`, { headers });
      expect(lista.status).toBe(200);
      z.array(ActividadResumen).parse(await lista.json());

      const detalle = await fetch(
        `${base}/actividades/${ACTIVIDAD_DE_OPERARIO1}`,
        { headers },
      );
      expect(detalle.status).toBe(200);
      ActividadDetalle.parse(await detalle.json());
    });

    it("PUT /registros-jornada/:id y GET /registros-jornada", async () => {
      const { accessToken: operario } = await login("operario1@plomada.local");
      const { accessToken: supervisor } = await login(
        "supervisor@plomada.local",
      );
      const id = crypto.randomUUID();

      const res = await fetch(`${base}/registros-jornada/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${operario}`,
        },
        body: JSON.stringify({
          tipo: "salida_centro",
          centroTrabajoId: CENTRO,
          capturadoEn: "2026-11-03T17:00:00.000Z",
        }),
      });
      expect(res.status).toBe(201);
      RegistroJornada.parse(await res.json());

      const lista = await fetch(`${base}/registros-jornada?fecha=2026-11-03`, {
        headers: { Authorization: `Bearer ${supervisor}` },
      });
      expect(lista.status).toBe(200);
      z.array(RegistroJornada).parse(await lista.json());
    });

    it("POST /usuarios crea un operario con correo de otro dominio (nota 015)", async () => {
      const { accessToken } = await login("admin@plomada.local");
      const correo = `operario-${crypto.randomUUID()}@empresa.com`;
      const res = await fetch(`${base}/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nombre: "Operario Externo",
          correo,
          rol: "operario",
          contrasenaInicial: "Plomada2026!",
        }),
      });
      expect(res.status).toBe(201);
      const usuario = Usuario.parse(await res.json());
      expect(usuario.correo).toBe(correo);
      expect(usuario.rol).toBe("operario");
    });

    it("la API no anuncia el framework en la cabecera x-powered-by", async () => {
      const res = await fetch(`${base}/salud`);
      expect(res.headers.get("x-powered-by")).toBeNull();
    });

    it("una ruta desconocida de la API responde no_encontrado en JSON", async () => {
      await esError(await fetch(`${base}/no-existe`), 404, "no_encontrado");
    });

    it("un JSON roto en la API responde validacion en JSON", async () => {
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"correo":',
      });
      await esError(res, 422, "validacion");
    });

    it("un cuerpo de más de 5 MB responde validacion en JSON", async () => {
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relleno: "x".repeat(6 * 1024 * 1024) }),
      });
      await esError(res, 422, "validacion");
    });

    describe("estado único de la actividad en los cuatro puntos de consulta (B-3)", () => {
      const lunes = obtenerLunesSemanaActual();

      function estadoEn(
        json: unknown,
        actividadId: string,
      ): string | undefined {
        if (Array.isArray(json)) {
          for (const x of json) {
            const r = estadoEn(x, actividadId);
            if (r) return r;
          }
        } else if (json && typeof json === "object") {
          const o = json as Record<string, unknown>;
          if (o.id === actividadId && typeof o.estado === "string")
            return o.estado;
          for (const v of Object.values(o)) {
            const r = estadoEn(v, actividadId);
            if (r) return r;
          }
        }
        return undefined;
      }

      async function registrar(
        token: string,
        actividadId: string,
        tipo: string,
        capturadoEn: string,
      ) {
        const res = await fetch(
          `${base}/registros-jornada/${crypto.randomUUID()}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ tipo, actividadId, capturadoEn }),
          },
        );
        expect(res.status).toBe(201);
      }

      async function estadosEnLosCuatroPuntos(
        correoOperario: string,
        actividadId: string,
        fecha: string,
      ) {
        const { accessToken: op } = await login(correoOperario);
        const { accessToken: sup } = await login("supervisor@plomada.local");
        const get = async (ruta: string, token: string) => {
          const res = await fetch(`${base}${ruta}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          expect(res.status).toBe(200);
          return res.json();
        };
        return {
          miProgramacion: estadoEn(
            await get("/mi-programacion", op),
            actividadId,
          ),
          seguimiento: estadoEn(
            await get(`/seguimiento/dia?fecha=${fecha}`, sup),
            actividadId,
          ),
          listado: estadoEn(await get("/actividades", sup), actividadId),
          detalle: estadoEn(
            await get(`/actividades/${actividadId}`, sup),
            actividadId,
          ),
        };
      }

      const caso = (estado: string) => ({
        miProgramacion: estado,
        seguimiento: estado,
        listado: estado,
        detalle: estado,
      });

      it("solo inicio_actividad: en_curso en los cuatro", async () => {
        const act = "50000000-0000-4000-8000-000000000004";
        const { accessToken } = await login("operario2@plomada.local");
        await registrar(
          accessToken,
          act,
          "inicio_actividad",
          "2026-11-03T08:00:00.000Z",
        );
        expect(
          await estadosEnLosCuatroPuntos(
            "operario2@plomada.local",
            act,
            sumarDias(lunes, 2),
          ),
        ).toEqual(caso("en_curso"));
      });

      it("solo fin_actividad: finalizada en los cuatro", async () => {
        const act = "50000000-0000-4000-8000-000000000005";
        const { accessToken } = await login("operario3@plomada.local");
        await registrar(
          accessToken,
          act,
          "fin_actividad",
          "2026-11-03T10:00:00.000Z",
        );
        expect(
          await estadosEnLosCuatroPuntos(
            "operario3@plomada.local",
            act,
            sumarDias(lunes, 3),
          ),
        ).toEqual(caso("finalizada"));
      });

      it("el fin llega antes que el inicio: finalizada en los cuatro", async () => {
        const act = "50000000-0000-4000-8000-000000000003";
        const { accessToken } = await login("operario1@plomada.local");
        await registrar(
          accessToken,
          act,
          "fin_actividad",
          "2026-11-03T10:00:00.000Z",
        );
        await registrar(
          accessToken,
          act,
          "inicio_actividad",
          "2026-11-03T08:00:00.000Z",
        );
        expect(
          await estadosEnLosCuatroPuntos(
            "operario1@plomada.local",
            act,
            sumarDias(lunes, 1),
          ),
        ).toEqual(caso("finalizada"));
      });
    });

    describe("propiedad de la actividad y existencia del centro (B-2)", () => {
      async function put(token: string, id: string, cuerpo: object) {
        return fetch(`${base}/registros-jornada/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(cuerpo),
        });
      }
      const inicio = {
        tipo: "inicio_actividad",
        actividadId: ACTIVIDAD_DE_OPERARIO1,
        capturadoEn: "2026-11-03T08:00:00.000Z",
      };

      it("un operario no registra jornada sobre la actividad de otro: 403 y ninguna fila nueva", async () => {
        const { accessToken } = await login("operario2@plomada.local");
        const id = crypto.randomUUID();
        await esError(await put(accessToken, id, inicio), 403, "sin_permiso");
        const filas = await pool.query(
          "SELECT 1 FROM registros_jornada WHERE id = $1",
          [id],
        );
        expect(filas.rowCount).toBe(0);
      });

      it("actividad inexistente responde 404", async () => {
        const { accessToken } = await login("operario1@plomada.local");
        await esError(
          await put(accessToken, crypto.randomUUID(), {
            ...inicio,
            actividadId: crypto.randomUUID(),
          }),
          404,
          "no_encontrado",
        );
      });

      it("centro de trabajo inexistente responde 404", async () => {
        const { accessToken } = await login("operario1@plomada.local");
        await esError(
          await put(accessToken, crypto.randomUUID(), {
            tipo: "entrada_centro",
            centroTrabajoId: crypto.randomUUID(),
            capturadoEn: "2026-11-03T07:00:00.000Z",
          }),
          404,
          "no_encontrado",
        );
      });

      it("el reintento idéntico responde 200 y con otro contenido 409", async () => {
        const { accessToken } = await login("operario1@plomada.local");
        const id = crypto.randomUUID();
        expect((await put(accessToken, id, inicio)).status).toBe(201);
        expect((await put(accessToken, id, inicio)).status).toBe(200);
        await esError(
          await put(accessToken, id, {
            ...inicio,
            capturadoEn: "2026-11-03T08:05:00.000Z",
          }),
          409,
          "conflicto",
        );
      });
    });
  });

  describe("evidencias idempotentes (B5)", () => {
    it("201 al primer PUT, 200 con los mismos campos y conflicto si cambian", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const headers = { Authorization: `Bearer ${accessToken}` };
      const id = crypto.randomUUID();
      const contenido = jpeg("foto-uno");
      const put = (form: FormData) =>
        fetch(`${base}/evidencias/${id}`, {
          method: "PUT",
          headers,
          body: form,
        });

      const primera = await put(formularioFoto("antes", contenido));
      expect(primera.status).toBe(201);
      Evidencia.parse(await primera.json());

      const repetida = await put(formularioFoto("antes", contenido));
      expect(repetida.status).toBe(200);
      Evidencia.parse(await repetida.json());

      // El contrato compara los campos de texto; el archivo de un id ya recibido no se reemplaza.
      const distinta = await put(formularioFoto("despues", contenido));
      await esError(distinta, 409, "conflicto");
    });

    it("un archivo de más de 1,5 MB responde archivo_invalido", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const res = await fetch(`${base}/evidencias/${crypto.randomUUID()}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formularioFoto("antes", Buffer.alloc(1_500_001, 1)),
      });
      await esError(res, 413, "archivo_invalido");
    });

    it("un tipo de archivo no permitido responde archivo_invalido", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const res = await fetch(`${base}/evidencias/${crypto.randomUUID()}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formularioFoto(
          "antes",
          Buffer.from("%PDF-1.4"),
          "application/pdf",
        ),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(ErrorApi.parse(await res.json()).codigo).toBe("archivo_invalido");
    });

    it("un archivo que dice ser JPEG pero no lo es responde archivo_invalido (B-7)", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const res = await fetch(`${base}/evidencias/${crypto.randomUUID()}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formularioFoto("antes", Buffer.from("%PDF-1.4 no soy una foto")),
      });
      await esError(res, 415, "archivo_invalido");
    });

    // Hallazgo 4: multer solo limitaba el tamaño del archivo; los campos de texto no tenían tope.
    it("un multipart con campos de más responde validacion en JSON", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const form = formularioFoto("antes", jpeg("exceso-de-campos"));
      for (let i = 0; i < 50; i++) form.append(`relleno${i}`, "x");
      const res = await fetch(`${base}/evidencias/${crypto.randomUUID()}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      await esError(res, 422, "validacion");
    });

    it("un multipart con un segundo archivo responde validacion en JSON", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const form = formularioFoto("antes", jpeg("primera"));
      form.append("foto", new Blob([new Uint8Array(jpeg("segunda"))], { type: "image/jpeg" }), "otra");
      const res = await fetch(`${base}/evidencias/${crypto.randomUUID()}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      await esError(res, 422, "validacion");
    });

    it("dos PUT simultáneos del mismo id producen un solo 201 y un 200 (B-7)", async () => {
      const { accessToken } = await login("operario1@plomada.local");
      const id = crypto.randomUUID();
      const contenido = jpeg("carrera");
      const put = () =>
        fetch(`${base}/evidencias/${id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formularioFoto("durante", contenido),
        });
      const estados = (await Promise.all([put(), put()]))
        .map((r) => r.status)
        .sort();
      expect(estados).toEqual([200, 201]);
    });

    it("la foto solo se sirve con token", async () => {
      const { accessToken } = await login("supervisor@plomada.local");
      const detalle = ActividadDetalle.parse(
        await (
          await fetch(`${base}/actividades/${ACTIVIDAD_DE_OPERARIO1}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        ).json(),
      );
      const evidenciaId = detalle.evidencias[0]?.id;
      expect(evidenciaId).toBeDefined();

      await esError(
        await fetch(`${base}/evidencias/${evidenciaId}/foto`),
        401,
        "no_autenticado",
      );
    });
  });

  describe("revisión del supervisor (B5)", () => {
    it("revisar una actividad sin evidencia es rechazado", async () => {
      const { accessToken } = await login("supervisor@plomada.local");
      const res = await fetch(
        `${base}/actividades/${ACTIVIDAD_SIN_EVIDENCIA}/revision`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ resultado: "aprobada" }),
        },
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
      ErrorApi.parse(await res.json());
    });

    it("rechazar sin observación responde validacion", async () => {
      const { accessToken } = await login("supervisor@plomada.local");
      const res = await fetch(
        `${base}/actividades/${ACTIVIDAD_DE_OPERARIO1}/revision`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ resultado: "rechazada" }),
        },
      );
      await esError(res, 422, "validacion");
    });

    it("rechazar con observación devuelve una Revision", async () => {
      const { accessToken } = await login("supervisor@plomada.local");
      const res = await fetch(
        `${base}/actividades/${ACTIVIDAD_DE_OPERARIO1}/revision`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            resultado: "rechazada",
            observacion: "Falta la foto del después",
          }),
        },
      );
      expect(res.status).toBe(200);
      Revision.parse(await res.json());
    });
  });
});
