import type { EstadoProgramacion, Fecha, Id, Instante } from "@plomada/shared";

export interface ActividadPersistida {
  id: Id;
  descripcion: string;
}

export interface AsignacionPersistida {
  id: Id;
  operarioId: Id;
  centroTrabajoId: Id;
  fecha: Fecha;
  actividades: ActividadPersistida[];
}

export interface ProgramacionPersistida {
  id: Id;
  semanaInicio: Fecha;
  estado: EstadoProgramacion;
  publicadaEn?: Instante;
  asignaciones: AsignacionPersistida[];
}

export interface ProgramacionRepositoryPort {
  guardar(programacion: ProgramacionPersistida): Promise<void>;
  buscarPorId(id: string): Promise<ProgramacionPersistida | null>;
  buscarPorSemana(semanaInicio: Fecha): Promise<ProgramacionPersistida | null>;
  listar(filtro?: { semanaInicio?: Fecha }): Promise<ProgramacionPersistida[]>;
  buscarPublicadaParaOperario(
    operarioId: string,
    semanaInicio?: Fecha,
  ): Promise<ProgramacionPersistida | null>;
  actualizarEstado(
    id: string,
    estado: EstadoProgramacion,
    publicadaEn: Instante,
  ): Promise<void>;
}
