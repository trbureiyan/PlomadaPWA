import { Router } from "express";
import {
  CentroTrabajoCrear,
  Id,
  MiProgramacionFiltro,
  ProgramacionCrear,
  ProgramacionesFiltro,
} from "@plomada/shared";
import { responderError } from "../../../../infrastructure/http/validation";
import type { CrearCentroTrabajoUseCase } from "../../application/crear-centro-trabajo.use-case";
import type { CrearProgramacionUseCase } from "../../application/crear-programacion.use-case";
import type { ListarCentrosTrabajoUseCase } from "../../application/listar-centros-trabajo.use-case";
import type { ListarProgramacionesUseCase } from "../../application/listar-programaciones.use-case";
import type { ObtenerMiProgramacionUseCase } from "../../application/obtener-mi-programacion.use-case";
import type { ObtenerProgramacionUseCase } from "../../application/obtener-programacion.use-case";
import type { PublicarProgramacionUseCase } from "../../application/publicar-programacion.use-case";
import {
  crearAuthMiddleware,
  exigirRol,
  type TokenVerifier,
} from "../../../../infrastructure/http/auth.middleware";

export interface DependenciasProgramacionRouter {
  crearCentroTrabajoUseCase: CrearCentroTrabajoUseCase;
  listarCentrosTrabajoUseCase: ListarCentrosTrabajoUseCase;
  crearProgramacionUseCase: CrearProgramacionUseCase;
  obtenerProgramacionUseCase: ObtenerProgramacionUseCase;
  listarProgramacionesUseCase: ListarProgramacionesUseCase;
  publicarProgramacionUseCase: PublicarProgramacionUseCase;
  obtenerMiProgramacionUseCase: ObtenerMiProgramacionUseCase;
  tokenService: TokenVerifier;
}

export function crearProgramacionRouter(deps: DependenciasProgramacionRouter): Router {
  const router = Router();
  const auth = crearAuthMiddleware(deps.tokenService);
  const rolGestion = exigirRol("administrador", "administrativo");
  const rolOperario = exigirRol("operario");

  // GET /centros-trabajo (autenticado)
  router.get("/centros-trabajo", auth, async (_req, res) => {
    try {
      const centros = await deps.listarCentrosTrabajoUseCase.ejecutar();
      res.status(200).json(centros);
    } catch (error) {
      responderError(res, error);
    }
  });

  // POST /centros-trabajo (administrativo, administrador)
  router.post("/centros-trabajo", auth, rolGestion, async (req, res) => {
    try {
      const cuerpo = CentroTrabajoCrear.parse(req.body);
      const centro = await deps.crearCentroTrabajoUseCase.ejecutar(cuerpo);
      res.status(201).json(centro);
    } catch (error) {
      responderError(res, error);
    }
  });

  // POST /programaciones (administrativo, administrador)
  router.post("/programaciones", auth, rolGestion, async (req, res) => {
    try {
      const cuerpo = ProgramacionCrear.parse(req.body);
      const programacion = await deps.crearProgramacionUseCase.ejecutar(cuerpo);
      res.status(201).json(programacion);
    } catch (error) {
      responderError(res, error);
    }
  });

  // GET /programaciones (administrativo, administrador)
  router.get("/programaciones", auth, rolGestion, async (req, res) => {
    try {
      const filtro = ProgramacionesFiltro.parse(req.query);
      const programaciones = await deps.listarProgramacionesUseCase.ejecutar(filtro);
      res.status(200).json(programaciones);
    } catch (error) {
      responderError(res, error);
    }
  });

  // GET /programaciones/:id (administrativo, administrador)
  router.get("/programaciones/:id", auth, rolGestion, async (req, res) => {
    try {
      const id = Id.parse(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const programacion = await deps.obtenerProgramacionUseCase.ejecutar(id);
      res.status(200).json(programacion);
    } catch (error) {
      responderError(res, error);
    }
  });

  // POST /programaciones/:id/publicar (administrativo, administrador)
  router.post("/programaciones/:id/publicar", auth, rolGestion, async (req, res) => {
    try {
      const id = Id.parse(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const programacion = await deps.publicarProgramacionUseCase.ejecutar(id);
      res.status(200).json(programacion);
    } catch (error) {
      responderError(res, error);
    }
  });

  // GET /mi-programacion (operario)
  router.get("/mi-programacion", auth, rolOperario, async (req, res) => {
    try {
      if (!req.usuario) {
        res.status(401).json({ codigo: "no_autenticado", mensaje: "No autenticado" });
        return;
      }
      const filtro = MiProgramacionFiltro.parse(req.query);
      const miProg = await deps.obtenerMiProgramacionUseCase.ejecutar(req.usuario.id, filtro);
      res.status(200).json(miProg);
    } catch (error) {
      responderError(res, error);
    }
  });

  return router;
}
