// B-6: GET /seguimiento/dia no tenía ninguna prueba. Se valida la respuesta con el
// esquema de shared (el contrato) y las reglas de docs/contrato-api.md.
import type { Server } from "node:http";
import { ErrorApi, SeguimientoDia, SesionRespuesta } from "@plomada/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearApp } from "./composition-root";
import { hoyEnNegocio } from "./compartido/tiempo";
import { obtenerLunesSemanaActual, sembrarDatos } from "./seed";

const OPERARIO1 = "10000000-0000-4000-8000-000000000004";
const OPERARIO2 = "10000000-0000-4000-8000-000000000005";
const CENTRO_ROBLES = "20000000-0000-4000-8000-000000000001";
const ACTIVIDAD_CON_FOTO = "50000000-0000-4000-8000-000000000001";
const ACTIVIDAD_SIN_FOTO = "50000000-0000-4000-8000-000000000002";

describe("GET /seguimiento/dia", () => {
  let server: Server;
  let base: string;
  let cerrarPool: () => Promise<void>;
  const lunes = obtenerLunesSemanaActual();

  beforeAll(async () => {
    await sembrarDatos();
    const { app, pool } = crearApp();
    cerrarPool = () => pool.end();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object")
          base = `http://localhost:${addr.port}/api/v1`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cerrarPool();
  });

  async function login(correo: string) {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, contrasena: "Plomada2026!" }),
    });
    expect(res.status).toBe(200);
    return SesionRespuesta.parse(await res.json()).accessToken;
  }

  async function seguimiento(fecha?: string, token?: string) {
    const jwt = token ?? (await login("supervisor@plomada.local"));
    const consulta = fecha ? `?fecha=${fecha}` : "";
    return fetch(`${base}/seguimiento/dia${consulta}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
  }

  async function dia(fecha: string) {
    const res = await seguimiento(fecha);
    expect(res.status).toBe(200);
    return SeguimientoDia.parse(await res.json());
  }

  it("devuelve a los tres operarios con el centro y las actividades publicadas del día", async () => {
    const respuesta = await dia(lunes);
    expect(respuesta.fecha).toBe(lunes);
    expect(respuesta.operarios).toHaveLength(3);

    const op1 = respuesta.operarios.find((o) => o.operario.id === OPERARIO1);
    expect(op1?.centroTrabajo?.id).toBe(CENTRO_ROBLES);
    expect(op1?.actividades.map((a) => a.id).sort()).toEqual([
      ACTIVIDAD_CON_FOTO,
      ACTIVIDAD_SIN_FOTO,
    ]);
  });

  it("deriva el estado y cuenta las evidencias recibidas de cada actividad", async () => {
    const op1 = (await dia(lunes)).operarios.find(
      (o) => o.operario.id === OPERARIO1,
    );
    const conFoto = op1?.actividades.find((a) => a.id === ACTIVIDAD_CON_FOTO);
    const sinFoto = op1?.actividades.find((a) => a.id === ACTIVIDAD_SIN_FOTO);
    expect(conFoto).toMatchObject({
      estado: "en_curso",
      evidenciasRecibidas: 1,
    });
    expect(sinFoto).toMatchObject({
      estado: "pendiente",
      evidenciasRecibidas: 0,
    });
  });

  it("un operario sin asignaciones ese día tiene centro null y ninguna actividad", async () => {
    const op2 = (await dia(lunes)).operarios.find(
      (o) => o.operario.id === OPERARIO2,
    );
    expect(op2).toMatchObject({
      centroTrabajo: null,
      entradaEn: null,
      salidaEn: null,
      actividades: [],
    });
  });

  it("entradaEn es la primera entrada y salidaEn la última salida, sin importar el orden de llegada", async () => {
    const token = await login("operario1@plomada.local");
    const registrar = async (tipo: string, hora: string) => {
      const res = await fetch(
        `${base}/registros-jornada/${crypto.randomUUID()}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tipo,
            centroTrabajoId: CENTRO_ROBLES,
            capturadoEn: `${lunes}T${hora}.000Z`,
          }),
        },
      );
      expect(res.status).toBe(201);
    };
    // Llegan desordenadas, como una cola que sincroniza horas después.
    await registrar("salida_centro", "12:00:00");
    await registrar("entrada_centro", "09:00:00");
    await registrar("salida_centro", "17:00:00");
    await registrar("entrada_centro", "07:55:00");

    const op1 = (await dia(lunes)).operarios.find(
      (o) => o.operario.id === OPERARIO1,
    );
    expect(op1?.entradaEn).toBe(`${lunes}T07:55:00.000Z`);
    expect(op1?.salidaEn).toBe(`${lunes}T17:00:00.000Z`);
  });

  it("un día sin programación publicada responde 200 con todos los operarios sin centro", async () => {
    const respuesta = await dia("2000-01-03");
    expect(respuesta.operarios).toHaveLength(3);
    expect(
      respuesta.operarios.every(
        (o) => o.centroTrabajo === null && o.actividades.length === 0,
      ),
    ).toBe(true);
  });

  it("sin fecha entrega el día de hoy", async () => {
    const res = await seguimiento();
    expect(res.status).toBe(200);
    expect(SeguimientoDia.parse(await res.json()).fecha).toBe(hoyEnNegocio());
  });

  it("una fecha mal formada responde validacion", async () => {
    const res = await seguimiento("03-11-2026");
    expect(res.status).toBe(422);
    expect(ErrorApi.parse(await res.json()).codigo).toBe("validacion");
  });

  it("el operario recibe sin_permiso y sin token no_autenticado", async () => {
    const operario = await seguimiento(
      lunes,
      await login("operario1@plomada.local"),
    );
    expect(operario.status).toBe(403);
    expect(ErrorApi.parse(await operario.json()).codigo).toBe("sin_permiso");

    const anonimo = await fetch(`${base}/seguimiento/dia?fecha=${lunes}`);
    expect(anonimo.status).toBe(401);
    expect(ErrorApi.parse(await anonimo.json()).codigo).toBe("no_autenticado");
  });

  it("administrador y administrativo también pueden consultarlo", async () => {
    for (const correo of [
      "admin@plomada.local",
      "administrativo@plomada.local",
    ]) {
      expect((await seguimiento(lunes, await login(correo))).status).toBe(200);
    }
  });
});
