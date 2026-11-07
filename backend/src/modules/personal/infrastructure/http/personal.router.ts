import { Router } from "express";
import { HojaDeVidaGuardar, Id } from "@plomada/shared";
import { responderError } from "../../../../infrastructure/http/validation";
import type { GuardarHojaDeVidaUseCase } from "../../application/guardar-hoja-de-vida.use-case";
import type { ObtenerHojaDeVidaUseCase } from "../../application/obtener-hoja-de-vida.use-case";
import {
  crearAuthMiddleware,
  exigirRol,
  type TokenVerifier,
} from "../../../../infrastructure/http/auth.middleware";

export interface DependenciasPersonalRouter {
  obtenerHojaDeVidaUseCase: ObtenerHojaDeVidaUseCase;
  guardarHojaDeVidaUseCase: GuardarHojaDeVidaUseCase;
  tokenService: TokenVerifier;
}

export function crearPersonalRouter(deps: DependenciasPersonalRouter): Router {
  const router = Router();
  const auth = crearAuthMiddleware(deps.tokenService);
  const rolRevision = exigirRol(
    "supervisor",
    "administrativo",
    "administrador",
  );
  const rolGestion = exigirRol("administrativo", "administrador");

  // GET /operarios/:id/hoja-de-vida (supervisor, administrativo, administrador)
  router.get(
    "/operarios/:id/hoja-de-vida",
    auth,
    rolRevision,
    async (req, res) => {
      try {
        const id = Id.parse(
          Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        );
        const hoja = await deps.obtenerHojaDeVidaUseCase.ejecutar(id);
        if (!hoja) {
          res.status(404).json({
            codigo: "no_encontrado",
            mensaje: "Hoja de vida no encontrada",
          });
          return;
        }
        res.status(200).json(hoja);
      } catch (error) {
        responderError(res, error);
      }
    },
  );

  // PUT /operarios/:id/hoja-de-vida (administrativo, administrador)
  router.put(
    "/operarios/:id/hoja-de-vida",
    auth,
    rolGestion,
    async (req, res) => {
      try {
        const id = Id.parse(
          Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        );
        const cuerpo = HojaDeVidaGuardar.parse(req.body);
        const hoja = await deps.guardarHojaDeVidaUseCase.ejecutar(id, cuerpo);
        res.status(200).json(hoja);
      } catch (error) {
        responderError(res, error);
      }
    },
  );

  return router;
}
