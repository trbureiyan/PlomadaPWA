import type { Response } from "express";
import { ZodError } from "zod";

export function responderErrorValidacion(res: Response, error: ZodError): void {
  const campos = error.issues.map((issue) => ({
    campo: issue.path.join("."),
    mensaje: issue.message,
  }));

  res.status(422).json({
    codigo: "validacion",
    mensaje: "Los datos enviados no cumplen con el esquema de validación",
    campos,
  });
}

export function responderError(res: Response, error: unknown): void {
  if (error instanceof ZodError) {
    responderErrorValidacion(res, error);
    return;
  }

  const err = error as Error & { codigo?: string; status?: number };
  const nombre = err.name;

  if (nombre === "CredencialesInvalidasError" || nombre === "SesionInvalidaError") {
    res.status(401).json({ codigo: "no_autenticado", mensaje: err.message });
    return;
  }

  if (nombre === "CorreoInstitucionalInvalidoError") {
    res.status(422).json({
      codigo: "validacion",
      mensaje: err.message,
      campos: [{ campo: "correo", mensaje: err.message }],
    });
    return;
  }

  if (nombre === "SinPermisoError") {
    res.status(403).json({ codigo: "sin_permiso", mensaje: err.message });
    return;
  }

  if (nombre === "UsuarioNoEncontradoError" || nombre === "RecursoNoEncontradoError") {
    res.status(404).json({ codigo: "no_encontrado", mensaje: err.message });
    return;
  }

  if (nombre === "CorreoYaRegistradoError" || nombre === "ConflictoEstadoError" || nombre === "ConflictoError") {
    res.status(409).json({ codigo: "conflicto", mensaje: err.message });
    return;
  }

  if (nombre === "ArchivoInvalidoError") {
    res.status(415).json({ codigo: "archivo_invalido", mensaje: err.message });
    return;
  }

  console.error("Error no controlado:", error);
  res.status(500).json({ codigo: "error_interno", mensaje: "Ocurrió un error interno en el servidor" });
}
