import type { Fecha, Id } from "@plomada/shared";

export interface ActividadInfo {
  id: Id;
  descripcion: string;
  operarioId: Id;
  operarioNombre: string;
  centroTrabajoId: Id;
  centroTrabajoNombre: string;
  centroTrabajoDireccion?: string;
  fecha: Fecha;
}

export interface ConsultaActividadPort {
  buscarActividad(id: Id): Promise<ActividadInfo | null>;
  listarActividades(filtro?: { fecha?: Fecha; centroTrabajoId?: Id }): Promise<ActividadInfo[]>;
}
