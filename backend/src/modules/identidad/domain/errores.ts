export class CredencialesInvalidasError extends Error {
  constructor(message = "Correo o contraseña incorrectos") {
    super(message);
    this.name = "CredencialesInvalidasError";
  }
}

export class UsuarioNoEncontradoError extends Error {
  constructor(id: string) {
    super(`Usuario con id ${id} no encontrado`);
    this.name = "UsuarioNoEncontradoError";
  }
}

export class CorreoYaRegistradoError extends Error {
  constructor(correo: string) {
    super(`El correo ${correo} ya está registrado`);
    this.name = "CorreoYaRegistradoError";
  }
}

export class SesionInvalidaError extends Error {
  constructor(message = "Sesión inválida, revocada o expirada") {
    super(message);
    this.name = "SesionInvalidaError";
  }
}

export class SinPermisoError extends Error {
  constructor(message = "No tiene permisos para realizar esta operación") {
    super(message);
    this.name = "SinPermisoError";
  }
}

export class CorreoInstitucionalInvalidoError extends Error {
  constructor(message = "El rol operario exige correo institucional @plomada.local") {
    super(message);
    this.name = "CorreoInstitucionalInvalidoError";
  }
}
