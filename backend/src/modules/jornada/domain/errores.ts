export class RegistroJornadaConflictoError extends Error {
  constructor(id: string) {
    super(`El registro de jornada con id ${id} ya existe con datos diferentes`);
    this.name = "ConflictoError";
  }
}

export class ActividadNoEncontradaError extends Error {
  constructor(id: string) {
    super(`Actividad con id ${id} no encontrada`);
    this.name = "RecursoNoEncontradoError";
  }
}

export class CentroNoEncontradoError extends Error {
  constructor(id: string) {
    super(`Centro de trabajo con id ${id} no encontrado`);
    this.name = "RecursoNoEncontradoError";
  }
}

export class ActividadAjenaError extends Error {
  constructor() {
    super("La actividad no está asignada al operario autenticado");
    this.name = "SinPermisoError";
  }
}
