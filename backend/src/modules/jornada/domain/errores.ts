export class RegistroJornadaConflictoError extends Error {
  constructor(id: string) {
    super(`El registro de jornada con id ${id} ya existe con datos diferentes`);
    this.name = "ConflictoError";
  }
}
