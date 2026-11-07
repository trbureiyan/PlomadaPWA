import { Router } from "express";
import { SeguimientoFiltro } from "@plomada/shared";
import { responderError } from "../../../../infrastructure/http/validation";
import type { ObtenerSeguimientoDiaUseCase } from "../../application/obtener-seguimiento-dia.use-case";
import {
  crearAuthMiddleware,
  exigirRol,
  type TokenVerifier,
} from "../../../../infrastructure/http/auth.middleware";

export interface DependenciasSeguimientoRouter {
  obtenerSeguimientoDiaUseCase: ObtenerSeguimientoDiaUseCase;
  tokenService: TokenVerifier;
}

export function crearSeguimientoRouter(
  deps: DependenciasSeguimientoRouter,
): Router {
  const router = Router();
  const auth = crearAuthMiddleware(deps.tokenService);
  const rolRevision = exigirRol(
    "supervisor",
    "administrativo",
    "administrador",
  );

  // GET /seguimiento/dia (supervisor, administrativo, administrador)
  router.get("/seguimiento/dia", auth, rolRevision, async (req, res) => {
    try {
      const filtro = SeguimientoFiltro.parse(req.query);
      const resultado =
        await deps.obtenerSeguimientoDiaUseCase.ejecutar(filtro);
      res.status(200).json(resultado);
    } catch (error) {
      responderError(res, error);
    }
  });

  return router;
}
