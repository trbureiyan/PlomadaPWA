import { LIMITES_EVIDENCIA, type Evidencia, type TipoEvidencia } from "@plomada/shared";
import {
  ActividadNoEncontradaError,
  ArchivoInvalidoError,
  EvidenciaConflictoError,
} from "../domain/errores";
import type { EvidenciaEntidad } from "../domain/evidencia";
import type { AlmacenamientoEvidenciasPort } from "./ports/almacenamiento-evidencias.port";
import type { ConsultaActividadPort } from "./ports/consulta-actividad.port";
import type { EvidenciaRepositoryPort } from "./ports/evidencia-repository.port";

export interface SubirEvidenciaInput {
  id: string;
  actividadId: string;
  operarioId: string;
  tipo: TipoEvidencia;
  capturadaEn: string;
  archivo: {
    buffer: Buffer;
    tipoMime: string;
    tamanoBytes: number;
  };
}

export interface SubirEvidenciaResultado {
  esNuevo: boolean;
  evidencia: Evidencia;
}

export class SubirEvidenciaUseCase {
  constructor(
    private readonly evidenciaRepo: EvidenciaRepositoryPort,
    private readonly almacenamientoPort: AlmacenamientoEvidenciasPort,
    private readonly consultaActividadPort: ConsultaActividadPort,
  ) {}

  async ejecutar(input: SubirEvidenciaInput): Promise<SubirEvidenciaResultado> {
    // 1. Verificar idempotencia
    const existente = await this.evidenciaRepo.buscarPorId(input.id);
    if (existente) {
      const coincide =
        existente.actividadId === input.actividadId &&
        existente.tipo === input.tipo &&
        existente.capturadaEn === input.capturadaEn;

      if (!coincide) {
        throw new EvidenciaConflictoError(input.id);
      }

      return {
        esNuevo: false,
        evidencia: this.mapearRespuesta(existente),
      };
    }

    // 2. Validar archivo
    if (input.archivo.tamanoBytes > LIMITES_EVIDENCIA.tamanoMaximoBytes) {
      throw new ArchivoInvalidoError("El archivo excede el tamaño máximo permitido de 1.5 MB");
    }

    if (!LIMITES_EVIDENCIA.tiposMime.includes(input.archivo.tipoMime as "image/jpeg" | "image/webp")) {
      throw new ArchivoInvalidoError("Tipo de archivo no permitido. Solo se acepta JPEG o WebP");
    }

    // 3. Validar asignación de la actividad al operario
    const actividad = await this.consultaActividadPort.buscarActividad(input.actividadId);
    if (!actividad) {
      throw new ActividadNoEncontradaError(input.actividadId);
    }

    if (actividad.operarioId !== input.operarioId) {
      const err = new Error("El operario no tiene asignada esta actividad");
      err.name = "SinPermisoError";
      throw err;
    }

    // 4. Guardar archivo en disco a través del puerto
    const fotoRuta = await this.almacenamientoPort.guardarFoto(
      input.id,
      input.archivo.buffer,
      input.archivo.tipoMime,
    );

    const recibidaEn = new Date().toISOString();
    const nuevaEntidad: EvidenciaEntidad = {
      id: input.id,
      actividadId: input.actividadId,
      operarioId: input.operarioId,
      tipo: input.tipo,
      capturadaEn: input.capturadaEn,
      recibidaEn,
      tipoMime: input.archivo.tipoMime as "image/jpeg" | "image/webp",
      tamanoBytes: input.archivo.tamanoBytes,
      fotoRuta,
    };

    await this.evidenciaRepo.guardar(nuevaEntidad);

    return {
      esNuevo: true,
      evidencia: this.mapearRespuesta(nuevaEntidad),
    };
  }

  private mapearRespuesta(entidad: EvidenciaEntidad): Evidencia {
    return {
      id: entidad.id,
      actividadId: entidad.actividadId,
      operarioId: entidad.operarioId,
      tipo: entidad.tipo,
      capturadaEn: entidad.capturadaEn,
      recibidaEn: entidad.recibidaEn,
      tipoMime: entidad.tipoMime,
      tamanoBytes: entidad.tamanoBytes,
      fotoUrl: `/api/v1/evidencias/${entidad.id}/foto`,
    };
  }
}
