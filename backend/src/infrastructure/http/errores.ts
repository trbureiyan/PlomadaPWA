import type { ErrorRequestHandler, RequestHandler } from "express";

// Todo error de la API tiene la forma { codigo, mensaje, campos? } del contrato.
// Express responde HTML por defecto ante JSON roto, cuerpo excesivo o ruta
// desconocida, y su manejador final filtra la excepción fuera de producción.

export const rutaNoEncontrada: RequestHandler = (_req, res) => {
  res
    .status(404)
    .json({ codigo: "no_encontrado", mensaje: "La ruta no existe" });
};

export const manejadorErrores: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const { type, status } = (error ?? {}) as {
    type?: unknown;
    status?: unknown;
  };

  if (type === "entity.parse.failed") {
    res.status(422).json({
      codigo: "validacion",
      mensaje: "El cuerpo no es un JSON válido",
    });
    return;
  }
  if (type === "entity.too.large") {
    res.status(422).json({
      codigo: "validacion",
      mensaje: "El cuerpo supera el tamaño máximo permitido",
    });
    return;
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(422).json({
      codigo: "validacion",
      mensaje: "No se pudo procesar la solicitud",
    });
    return;
  }

  // El detalle va al log del servidor y nunca a la respuesta.
  console.error("Error no controlado:", error);
  res.status(500).json({
    codigo: "error_interno",
    mensaje: "Ocurrió un error interno en el servidor",
  });
};
