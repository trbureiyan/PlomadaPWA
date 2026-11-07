import { describe, expect, it } from "vitest";
import { SubirEvidenciaUseCase } from "./application/subir-evidencia.use-case";
import { ObtenerFotoEvidenciaUseCase } from "./application/obtener-foto-evidencia.use-case";
import { RevisarActividadUseCase } from "./application/revisar-actividad.use-case";
import { ListarActividadesSupervisorUseCase } from "./application/listar-actividades.use-case";
import { ObtenerActividadDetalleUseCase } from "./application/obtener-actividad-detalle.use-case";
import { InMemoryEvidenciaRepository } from "./infrastructure/persistence/in-memory-evidencia.repository";
import { InMemoryRevisionRepository } from "./infrastructure/persistence/in-memory-revision.repository";
import { InMemoryAlmacenamientoEvidencias } from "./infrastructure/storage/in-memory-almacenamiento-evidencias";
import type { ConsultaActividadPort } from "./application/ports/consulta-actividad.port";
import type { HechosActividad, HechosDeActividadPort } from "../programacion";
import {
  ArchivoInvalidoError,
  EvidenciaConflictoError,
  RevisionSinEvidenciaError,
} from "./domain/errores";

// Los primeros bytes identifican el formato: JPEG empieza con FF D8 FF y WebP es RIFF....WEBP.
const jpeg = (relleno: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from(relleno)]);
const webp = (relleno: string) =>
  Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.from(relleno)]);

describe("Módulo Evidencias y Revisión", () => {
  const evidenciaRepo = new InMemoryEvidenciaRepository();
  const revisionRepo = new InMemoryRevisionRepository();
  const almacenamiento = new InMemoryAlmacenamientoEvidencias();

  const mockConsultaActividad: ConsultaActividadPort = {
    async buscarActividad(id) {
      if (id === "act-1") {
        return {
          id: "act-1",
          descripcion: "Limpieza profunda de piscina",
          operarioId: "op-1",
          operarioNombre: "Juan Operario",
          centroTrabajoId: "centro-1",
          centroTrabajoNombre: "Los Robles",
          fecha: "2026-11-03",
        };
      }
      if (id === "act-vacia") {
        return {
          id: "act-vacia",
          descripcion: "Pintura fachada",
          operarioId: "op-1",
          operarioNombre: "Juan Operario",
          centroTrabajoId: "centro-1",
          centroTrabajoNombre: "Los Robles",
          fecha: "2026-11-03",
        };
      }
      return null;
    },
    async listarActividades() {
      return [
        {
          id: "act-1",
          descripcion: "Limpieza profunda de piscina",
          operarioId: "op-1",
          operarioNombre: "Juan Operario",
          centroTrabajoId: "centro-1",
          centroTrabajoNombre: "Los Robles",
          fecha: "2026-11-03",
        },
      ];
    },
  };

  // Hechos de jornada que en producción aporta el módulo jornada vía composition-root.
  const hechosDeJornada = new Map<string, Pick<HechosActividad, "tieneInicio" | "tieneFin">>();
  const hechos: HechosDeActividadPort = {
    async obtenerHechosPorActividadId(id) {
      return (await this.obtenerHechosPorActividadesIds([id])).get(id) as HechosActividad;
    },
    async obtenerHechosPorActividadesIds(ids) {
      const mapa = new Map<string, HechosActividad>();
      for (const id of ids) {
        const evidencias = await evidenciaRepo.listarPorActividadId(id);
        const revision = await revisionRepo.buscarPorActividadId(id);
        mapa.set(id, {
          ...hechosDeJornada.get(id),
          evidencias: evidencias.map((e) => ({ tipo: e.tipo })),
          revision: revision ? { resultado: revision.resultado } : undefined,
        });
      }
      return mapa;
    },
  };

  const subirEvidencia = new SubirEvidenciaUseCase(evidenciaRepo, almacenamiento, mockConsultaActividad);
  const obtenerFoto = new ObtenerFotoEvidenciaUseCase(evidenciaRepo, almacenamiento);
  const revisarActividad = new RevisarActividadUseCase(mockConsultaActividad, evidenciaRepo, revisionRepo);
  const listarActividades = new ListarActividadesSupervisorUseCase(mockConsultaActividad, hechos);
  const obtenerDetalle = new ObtenerActividadDetalleUseCase(mockConsultaActividad, evidenciaRepo, revisionRepo, hechos);

  it("sube una evidencia fotográfica por primera vez y responde con éxito", async () => {
    const fotoBuffer = jpeg("contenido-de-imagen-valida");
    const res = await subirEvidencia.ejecutar({
      id: "ev-1",
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "antes",
      capturadaEn: "2026-11-03T10:00:00Z",
      archivo: {
        buffer: fotoBuffer,
        tipoMime: "image/jpeg",
        tamanoBytes: fotoBuffer.length,
      },
    });

    expect(res.esNuevo).toBe(true);
    expect(res.evidencia.id).toBe("ev-1");
    expect(res.evidencia.tipo).toBe("antes");
    expect(res.evidencia.fotoUrl).toBe("/api/v1/evidencias/ev-1/foto");

    // Verificar que se puede recuperar el archivo
    const fotoObtenida = await obtenerFoto.ejecutar("ev-1", { id: "op-1", rol: "operario" });
    expect(fotoObtenida.buffer).toEqual(fotoBuffer);
    expect(fotoObtenida.tipoMime).toBe("image/jpeg");
  });

  it("la foto la ve su operario y quien revisa, pero no otro operario", async () => {
    await expect(obtenerFoto.ejecutar("ev-1", { id: "op-2", rol: "operario" })).rejects.toThrow(
      expect.objectContaining({ name: "SinPermisoError" }),
    );
    await expect(obtenerFoto.ejecutar("ev-1", { id: "sup-1", rol: "supervisor" })).resolves.toMatchObject({
      tipoMime: "image/jpeg",
    });
  });

  it("idempotencia: repetir el envío con el mismo contenido devuelve 200 sin duplicar", async () => {
    const fotoBuffer = jpeg("contenido-de-imagen-valida");
    const resRepetida = await subirEvidencia.ejecutar({
      id: "ev-1",
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "antes",
      capturadaEn: "2026-11-03T10:00:00Z",
      archivo: {
        buffer: fotoBuffer,
        tipoMime: "image/jpeg",
        tamanoBytes: fotoBuffer.length,
      },
    });

    expect(resRepetida.esNuevo).toBe(false);
    expect(resRepetida.evidencia.id).toBe("ev-1");
  });

  it("idempotencia: enviar el mismo id con contenido diferente devuelve conflicto", async () => {
    const fotoBuffer = jpeg("otro-contenido");
    await expect(
      subirEvidencia.ejecutar({
        id: "ev-1",
        actividadId: "act-1",
        operarioId: "op-1",
        tipo: "despues", // cambio de tipo
        capturadaEn: "2026-11-03T10:00:00Z",
        archivo: {
          buffer: fotoBuffer,
          tipoMime: "image/jpeg",
          tamanoBytes: fotoBuffer.length,
        },
      }),
    ).rejects.toThrow(EvidenciaConflictoError);
  });

  it("rechaza archivos mayores a 1.5 MB o tipos MIME inválidos", async () => {
    const bufferGrande = Buffer.alloc(1_500_001);
    await expect(
      subirEvidencia.ejecutar({
        id: "ev-grande",
        actividadId: "act-1",
        operarioId: "op-1",
        tipo: "durante",
        capturadaEn: "2026-11-03T11:00:00Z",
        archivo: {
          buffer: bufferGrande,
          tipoMime: "image/jpeg",
          tamanoBytes: bufferGrande.length,
        },
      }),
    ).rejects.toThrow(ArchivoInvalidoError);

    await expect(
      subirEvidencia.ejecutar({
        id: "ev-pdf",
        actividadId: "act-1",
        operarioId: "op-1",
        tipo: "durante",
        capturadaEn: "2026-11-03T11:00:00Z",
        archivo: {
          buffer: Buffer.from("pdf-data"),
          tipoMime: "application/pdf",
          tamanoBytes: 8,
        },
      }),
    ).rejects.toThrow(ArchivoInvalidoError);
  });

  it("impide revisar una actividad sin evidencias", async () => {
    await expect(
      revisarActividad.ejecutar("act-vacia", "sup-1", {
        resultado: "aprobada",
      }),
    ).rejects.toThrow(RevisionSinEvidenciaError);
  });

  it("permite revisar una actividad con evidencias y consultar el detalle", async () => {
    const revision = await revisarActividad.ejecutar("act-1", "sup-1", {
      resultado: "aprobada",
      observacion: "Excelente trabajo en la piscina",
    });

    expect(revision.actividadId).toBe("act-1");
    expect(revision.resultado).toBe("aprobada");
    expect(revision.supervisorId).toBe("sup-1");

    const detalle = await obtenerDetalle.ejecutar("act-1");
    expect(detalle.estado).toBe("aprobada");
    expect(detalle.evidencias.length).toBe(1);
    expect(detalle.revision?.resultado).toBe("aprobada");
  });

  describe("estado con hechos de jornada (B-3)", () => {
    const consultaVacia: ConsultaActividadPort = {
      buscarActividad: mockConsultaActividad.buscarActividad,
      async listarActividades() {
        return [
          {
            id: "act-vacia",
            descripcion: "Pintura fachada",
            operarioId: "op-1",
            operarioNombre: "Juan Operario",
            centroTrabajoId: "centro-1",
            centroTrabajoNombre: "Los Robles",
            fecha: "2026-11-03",
          },
        ];
      },
    };
    const listar = new ListarActividadesSupervisorUseCase(consultaVacia, hechos);

    it("solo inicio_actividad es en_curso en el listado y en el detalle", async () => {
      hechosDeJornada.set("act-vacia", { tieneInicio: true });
      expect((await listar.ejecutar())[0].estado).toBe("en_curso");
      expect((await obtenerDetalle.ejecutar("act-vacia")).estado).toBe("en_curso");
    });

    it("solo fin_actividad es finalizada en el listado y en el detalle", async () => {
      hechosDeJornada.set("act-vacia", { tieneFin: true });
      expect((await listar.ejecutar())[0].estado).toBe("finalizada");
      expect((await obtenerDetalle.ejecutar("act-vacia")).estado).toBe("finalizada");
    });
  });

  describe("firma del archivo y subida atómica (B-7)", () => {
    const subir = (id: string, buffer: Buffer, tipoMime: string) =>
      subirEvidencia.ejecutar({
        id,
        actividadId: "act-1",
        operarioId: "op-1",
        tipo: "durante",
        capturadaEn: "2026-11-03T12:00:00Z",
        archivo: { buffer, tipoMime, tamanoBytes: buffer.length },
      });

    it("rechaza un archivo cuyo contenido no es JPEG aunque diga image/jpeg", async () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await expect(subir("ev-png", png, "image/jpeg")).rejects.toThrow(ArchivoInvalidoError);
      expect(await evidenciaRepo.buscarPorId("ev-png")).toBeNull();
    });

    it("rechaza un archivo cuyo contenido no es WebP aunque diga image/webp", async () => {
      await expect(subir("ev-webp-falso", jpeg("x"), "image/webp")).rejects.toThrow(ArchivoInvalidoError);
    });

    it("acepta un WebP con firma válida", async () => {
      const res = await subir("ev-webp", webp("datos"), "image/webp");
      expect(res.esNuevo).toBe(true);
    });

    it("dos envíos simultáneos del mismo id producen un solo 201", async () => {
      const buffer = jpeg("carrera");
      const resultados = await Promise.all([subir("ev-carrera", buffer, "image/jpeg"), subir("ev-carrera", buffer, "image/jpeg")]);
      expect(resultados.filter((r) => r.esNuevo)).toHaveLength(1);
    });
  });
});
