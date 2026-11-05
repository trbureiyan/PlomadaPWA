import type {
  NotificacionProgramacionOperario,
  NotificadorProgramacionPort,
} from "../../application/ports/notificador-programacion.port";

export class InMemoryNotificadorProgramacion implements NotificadorProgramacionPort {
  public notificacionesEnviadas: NotificacionProgramacionOperario[] = [];

  async notificarOperarios(notificaciones: NotificacionProgramacionOperario[]): Promise<void> {
    this.notificacionesEnviadas.push(...notificaciones);
  }

  limpiar(): void {
    this.notificacionesEnviadas = [];
  }
}
