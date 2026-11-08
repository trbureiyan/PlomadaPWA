import { Router } from "express";
import {
  Id,
  RegistroJornadaSolicitud,
  RegistrosJornadaFiltro,
} from "@plomada/shared";
import { responderError } from "../../../../infrastructure/http/validation";
import type { ListarRegistrosJornadaUseCase } from "../../application/listar-registros-jornada.use-case";
import type { RegistrarJornadaUseCase } from "../../application/registrar-jornada.use-case";
import {
  crearAuthMiddleware,
  exigirRol,
  type TokenVerifier,
} from "../../../../infrastructure/http/auth.middleware";

export interface DependenciasJornadaRouter {
  registrarJornadaUseCase: RegistrarJornadaUseCase;
  listarRegistrosJornadaUseCase: ListarRegistrosJornadaUseCase;
  tokenService: TokenVerifier;
}

export function crearJornadaRouter(deps: DependenciasJornadaRouter): Router {
  const router = Router();
  const auth = crearAuthMiddleware(deps.tokenService);
  const rolOperario = exigirRol("operario");
  const rolRevision = exigirRol(
    "supervisor",
    "administrativo",
    "administrador",
  );

  // PUT /registros-jornada/:id (operario)
  router.put("/registros-jornada/:id", auth, rolOperario, async (req, res) => {
    try {
      const id = Id.parse(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );
      const cuerpo = RegistroJornadaSolicitud.parse(req.body);

      if (!req.usuario) {
        res
          .status(401)
          .json({ codigo: "no_autenticado", mensaje: "No autenticado" });
        return;
      }

      const resultado = await deps.registrarJornadaUseCase.ejecutar(
        id,
        req.usuario.id,
        cuerpo,
      );
      const statusHttp = resultado.esNuevo ? 201 : 200;
      res.status(statusHttp).json(resultado.registro);
    } catch (error) {
      responderError(res, error);
    }
  });

  // GET /registros-jornada (supervisor, administrativo, administrador)
  router.get("/registros-jornada", auth, rolRevision, async (req, res) => {
    try {
      const filtro = RegistrosJornadaFiltro.parse(req.query);
      const registros =
        await deps.listarRegistrosJornadaUseCase.ejecutar(filtro);
      res.status(200).json(registros);
    } catch (error) {
      responderError(res, error);
    }
  });

  return router;
}
