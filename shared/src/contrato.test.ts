import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  Evidencia,
  EvidenciaCampos,
  Instante,
  LIMITES_EVIDENCIA,
  ProgramacionCrear,
  RegistroJornadaSolicitud,
  RevisionSolicitud,
  SemanaInicio,
  rutas,
  type DefinicionRuta,
} from "./index";

// UUID v4 válidos y distinguibles para los ejemplos.
const u = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const lista = Object.entries(rutas) as [string, DefinicionRuta][];

describe("registro de rutas", () => {
  it("no repite método y ruta", () => {
    const claves = lista.map(([, r]) => `${r.metodo} ${r.ruta}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("aparece completo en docs/contrato-api.md", () => {
    const doc = readFileSync(
      fileURLToPath(new URL("../../docs/contrato-api.md", import.meta.url)),
      "utf8",
    );
    // Entre comillas invertidas para que "GET /actividades" no se dé por
    // documentado gracias a "GET /actividades/:id".
    const faltantes = lista
      .map(([, r]) => `\`${r.metodo} ${r.ruta}\``)
      .filter((clave) => !doc.includes(clave));
    expect(faltantes).toEqual([]);
  });

  it("deja en P0 el flujo mínimo de la demostración", () => {
    const p0 = lista.filter(([, r]) => r.prioridad === "P0").map(([n]) => n);
    expect(p0).toEqual(
      expect.arrayContaining([
        "iniciarSesion",
        "renovarSesion",
        "crearProgramacion",
        "publicarProgramacion",
        "miProgramacion",
        "subirEvidencia",
        "fotoEvidencia",
        "listarActividades",
        "obtenerActividad",
        "revisarActividad",
      ]),
    );
  });
});

describe("tiempo", () => {
  it("acepta UTC con Z y rechaza horas con desfase", () => {
    expect(Instante.safeParse("2026-11-04T17:00:00Z").success).toBe(true);
    expect(Instante.safeParse("2026-11-04T12:00:00-05:00").success).toBe(false);
    expect(Instante.safeParse("2026-11-04 12:00").success).toBe(false);
  });

  it("exige que la semana empiece en lunes", () => {
    expect(SemanaInicio.safeParse("2026-11-02").success).toBe(true);
    expect(SemanaInicio.safeParse("2026-11-04").success).toBe(false);
  });
});

describe("programación semanal", () => {
  const asignacion = (fecha: string) => ({
    operarioId: u(1),
    centroTrabajoId: u(2),
    fecha,
    actividades: [{ descripcion: "Limpiar la piscina" }],
  });

  it("acepta fechas de lunes a viernes", () => {
    const r = ProgramacionCrear.safeParse({
      semanaInicio: "2026-11-02",
      asignaciones: [asignacion("2026-11-02"), asignacion("2026-11-06")],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza fines de semana y fechas de otra semana", () => {
    for (const fecha of ["2026-11-07", "2026-11-09", "2026-11-01"]) {
      const r = ProgramacionCrear.safeParse({
        semanaInicio: "2026-11-02",
        asignaciones: [asignacion(fecha)],
      });
      expect(r.success, fecha).toBe(false);
    }
  });

  it("rechaza una asignación sin actividades", () => {
    const r = ProgramacionCrear.safeParse({
      semanaInicio: "2026-11-02",
      asignaciones: [{ ...asignacion("2026-11-02"), actividades: [] }],
    });
    expect(r.success).toBe(false);
  });
});

describe("registro de jornada", () => {
  const capturadoEn = "2026-11-04T13:05:00Z";

  it("entrada y salida piden centro; inicio y fin piden actividad", () => {
    expect(
      RegistroJornadaSolicitud.safeParse({
        tipo: "entrada_centro",
        centroTrabajoId: u(2),
        capturadoEn,
      }).success,
    ).toBe(true);
    expect(
      RegistroJornadaSolicitud.safeParse({
        tipo: "inicio_actividad",
        actividadId: u(3),
        capturadoEn,
      }).success,
    ).toBe(true);
  });

  it("rechaza mezclar los campos", () => {
    expect(
      RegistroJornadaSolicitud.safeParse({
        tipo: "entrada_centro",
        actividadId: u(3),
        capturadoEn,
      }).success,
    ).toBe(false);
    expect(
      RegistroJornadaSolicitud.safeParse({
        tipo: "fin_actividad",
        centroTrabajoId: u(2),
        capturadoEn,
      }).success,
    ).toBe(false);
  });
});

describe("evidencias", () => {
  it("acepta los tres tipos y rechaza otros", () => {
    for (const tipo of ["antes", "durante", "despues"]) {
      const r = EvidenciaCampos.safeParse({
        actividadId: u(3),
        tipo,
        capturadaEn: "2026-11-04T13:10:00Z",
      });
      expect(r.success, tipo).toBe(true);
    }
    expect(
      EvidenciaCampos.safeParse({
        actividadId: u(3),
        tipo: "final",
        capturadaEn: "2026-11-04T13:10:00Z",
      }).success,
    ).toBe(false);
  });

  it("describe la evidencia que devuelve el servidor", () => {
    const r = Evidencia.safeParse({
      id: u(4),
      actividadId: u(3),
      operarioId: u(1),
      tipo: "antes",
      capturadaEn: "2026-11-04T13:10:00Z",
      recibidaEn: "2026-11-04T21:30:00Z",
      tipoMime: "image/jpeg",
      tamanoBytes: 380_000,
      fotoUrl: `/evidencias/${u(4)}/foto`,
    });
    expect(r.success).toBe(true);
  });

  it("mantiene el objetivo de compresión por debajo del máximo", () => {
    expect(LIMITES_EVIDENCIA.tamanoObjetivoBytes).toBeLessThan(
      LIMITES_EVIDENCIA.tamanoMaximoBytes,
    );
  });
});

describe("revisión del supervisor", () => {
  it("aprobar no exige observación", () => {
    expect(RevisionSolicitud.safeParse({ resultado: "aprobada" }).success).toBe(
      true,
    );
  });

  it("rechazar exige observación con contenido", () => {
    expect(
      RevisionSolicitud.safeParse({ resultado: "rechazada" }).success,
    ).toBe(false);
    expect(
      RevisionSolicitud.safeParse({ resultado: "rechazada", observacion: "  " })
        .success,
    ).toBe(false);
    expect(
      RevisionSolicitud.safeParse({
        resultado: "rechazada",
        observacion: "La pintura quedó con goteo en el muro norte",
      }).success,
    ).toBe(true);
  });
});

describe("validaciones de creación de usuario (CU-11)", () => {
  it("rechaza nombre vacío o menor a 3 caracteres", () => {
    const resVacio = rutas.crearUsuario.solicitud.safeParse({
      nombre: "   ",
      correo: "test@plomada.local",
      rol: "operario",
      contrasenaInicial: "Plomada2026!",
    });
    expect(resVacio.success).toBe(false);

    const resCorto = rutas.crearUsuario.solicitud.safeParse({
      nombre: "Al",
      correo: "test@plomada.local",
      rol: "operario",
      contrasenaInicial: "Plomada2026!",
    });
    expect(resCorto.success).toBe(false);
  });

  it("rechaza correo con formato inválido o sin dominio", () => {
    const resSinArroba = rutas.crearUsuario.solicitud.safeParse({
      nombre: "Alberto Gómez",
      correo: "correo-invalido",
      rol: "operario",
      contrasenaInicial: "Plomada2026!",
    });
    expect(resSinArroba.success).toBe(false);

    const resSinDominio = rutas.crearUsuario.solicitud.safeParse({
      nombre: "Alberto Gómez",
      correo: "correo@",
      rol: "operario",
      contrasenaInicial: "Plomada2026!",
    });
    expect(resSinDominio.success).toBe(false);
  });

  it("rechaza contraseña menor a 8 caracteres o compuesta únicamente de espacios", () => {
    const resCorta = rutas.crearUsuario.solicitud.safeParse({
      nombre: "Alberto Gómez",
      correo: "alberto@plomada.local",
      rol: "operario",
      contrasenaInicial: "12345",
    });
    expect(resCorta.success).toBe(false);

    const resEspacios = rutas.crearUsuario.solicitud.safeParse({
      nombre: "Alberto Gómez",
      correo: "alberto@plomada.local",
      rol: "operario",
      contrasenaInicial: "        ",
    });
    expect(resEspacios.success).toBe(false);
  });

  it("no fija el dominio del correo: acepta cualquier correo bien formado en todos los roles", () => {
    for (const correo of [
      "carlos@empresa.com",
      "carlos@plomada.local",
      "c.perez@mail.empresa.co",
    ]) {
      for (const rol of [
        "operario",
        "supervisor",
        "administrativo",
        "administrador",
      ]) {
        const res = rutas.crearUsuario.solicitud.safeParse({
          nombre: "Carlos Operario",
          correo,
          rol,
          contrasenaInicial: "Plomada2026!",
        });
        expect(res.success, `${rol} ${correo}`).toBe(true);
      }
    }
  });

  it("acepta usuario con datos íntegros y válidos", () => {
    const resValido = rutas.crearUsuario.solicitud.safeParse({
      nombre: "Alberto Gómez",
      correo: "alberto@plomada.local",
      rol: "operario",
      contrasenaInicial: "Segura2026!",
    });
    expect(resValido.success).toBe(true);
  });
});
