import type { Asignacion, Fecha } from "@plomada/shared";

export interface NotificacionProgramacionOperario {
  operarioId: string;
  correo: string;
  nombreOperario: string;
  semanaInicio: Fecha;
  asignaciones: Asignacion[];
}

export interface NotificadorProgramacionPort {
  notificarOperarios(
    notificaciones: NotificacionProgramacionOperario[],
  ): Promise<void>;
}
