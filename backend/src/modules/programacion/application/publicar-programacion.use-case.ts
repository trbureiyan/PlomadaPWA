import type { ProgramacionSemanal } from "@plomada/shared";
import { ProgramacionNoEncontradaError } from "../domain/errores";
import type { ObtenerProgramacionUseCase } from "./obtener-programacion.use-case";
import type {
  NotificacionProgramacionOperario,
  NotificadorProgramacionPort,
} from "./ports/notificador-programacion.port";
import type { ProgramacionRepositoryPort } from "./ports/programacion-repository.port";

export interface InfoOperario {
  id: string;
  nombre: string;
  correo: string;
}

export type ProveedorInfoOperarios = (ids: string[]) => Promise<Map<string, InfoOperario>>;

export class PublicarProgramacionUseCase {
  constructor(
    private readonly programacionRepo: ProgramacionRepositoryPort,
    private readonly obtenerProgramacionUseCase: ObtenerProgramacionUseCase,
    private readonly notificadorPort: NotificadorProgramacionPort,
    private readonly proveedorOperarios: ProveedorInfoOperarios,
  ) {}

  async ejecutar(id: string): Promise<ProgramacionSemanal> {
    const persistida = await this.programacionRepo.buscarPorId(id);
    if (!persistida) {
      throw new ProgramacionNoEncontradaError(id);
    }

    if (persistida.estado === "publicada") {
      // Ya publicada: idempotente, responde 200 sin reenviar correos
      return this.obtenerProgramacionUseCase.armarProgramacionSemanal(persistida);
    }

    const publicadaEn = new Date().toISOString();
    await this.programacionRepo.actualizarEstado(id, "publicada", publicadaEn);

    persistida.estado = "publicada";
    persistida.publicadaEn = publicadaEn;

    const armada = await this.obtenerProgramacionUseCase.armarProgramacionSemanal(persistida);

    // Enviar correos como efecto secundario no bloqueante
    this.dispararNotificaciones(armada).catch((err) => {
      console.error("Error al enviar correos de programación:", err);
    });

    return armada;
  }

  private async dispararNotificaciones(programacion: ProgramacionSemanal): Promise<void> {
    try {
      const operariosIds = Array.from(new Set(programacion.asignaciones.map((a) => a.operarioId)));
      const infoMap = await this.proveedorOperarios(operariosIds);

      const notificaciones: NotificacionProgramacionOperario[] = [];

      for (const opId of operariosIds) {
        const info = infoMap.get(opId);
        if (!info) continue;

        const asignacionesOperario = programacion.asignaciones.filter((a) => a.operarioId === opId);
        notificaciones.push({
          operarioId: opId,
          correo: info.correo,
          nombreOperario: info.nombre,
          semanaInicio: programacion.semanaInicio,
          asignaciones: asignacionesOperario,
        });
      }

      await this.notificadorPort.notificarOperarios(notificaciones);
    } catch (error) {
      console.error("Fallo durante el despacho de notificaciones:", error);
    }
  }
}
