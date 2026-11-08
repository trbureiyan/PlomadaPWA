export class ProgramacionSemanalExistenteError extends Error {
  constructor(semanaInicio: string) {
    super(`Ya existe una programación para la semana del ${semanaInicio}`);
    this.name = "ConflictoError";
  }
}

export class ProgramacionNoEncontradaError extends Error {
  constructor(id: string) {
    super(`Programación con id ${id} no encontrada`);
    this.name = "RecursoNoEncontradoError";
  }
}

export class CentroTrabajoNoEncontradoError extends Error {
  constructor(id: string) {
    super(`Centro de trabajo con id ${id} no encontrado`);
    this.name = "RecursoNoEncontradoError";
  }
}

export class ProgramacionYaPublicadaError extends Error {
  constructor(id: string) {
    super(`La programación ${id} ya está publicada y no puede ser modificada`);
    this.name = "ConflictoError";
  }
}
