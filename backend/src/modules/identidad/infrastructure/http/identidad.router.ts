import { Router } from "express";
import { LoginSolicitud, RefrescoSolicitud, UsuarioCrear, UsuariosFiltro } from "@plomada/shared";
import { responderError } from "../../../../infrastructure/http/validation";
import type { CrearUsuarioUseCase } from "../../application/crear-usuario.use-case";
import type { IniciarSesionUseCase } from "../../application/iniciar-sesion.use-case";
import type { ListarUsuariosUseCase } from "../../application/listar-usuarios.use-case";
import type { ObtenerUsuarioAutenticadoUseCase } from "../../application/obtener-usuario-autenticado.use-case";
import type { RenovarSesionUseCase } from "../../application/renovar-sesion.use-case";
import type { TokenServicePort } from "../../application/ports/token-service.port";
import { crearAuthMiddleware, exigirRol } from "./auth.middleware";

export interface DependenciasIdentidadRouter {
  iniciarSesionUseCase: IniciarSesionUseCase;
  renovarSesionUseCase: RenovarSesionUseCase;
  obtenerUsuarioAutenticadoUseCase: ObtenerUsuarioAutenticadoUseCase;
  listarUsuariosUseCase: ListarUsuariosUseCase;
  crearUsuarioUseCase: CrearUsuarioUseCase;
  tokenService: TokenServicePort;
}

export function crearIdentidadRouter(deps: DependenciasIdentidadRouter): Router {
  const router = Router();
  const authMiddleware = crearAuthMiddleware(deps.tokenService);

  // POST /auth/login (público)
  router.post("/auth/login", async (req, res) => {
    try {
      const cuerpo = LoginSolicitud.parse(req.body);
      const sesion = await deps.iniciarSesionUseCase.ejecutar(cuerpo);
      res.status(200).json(sesion);
    } catch (error) {
      responderError(res, error);
    }
  });

  // POST /auth/refresh (público)
  router.post("/auth/refresh", async (req, res) => {
    try {
      const cuerpo = RefrescoSolicitud.parse(req.body);
      const sesion = await deps.renovarSesionUseCase.ejecutar(cuerpo);
      res.status(200).json(sesion);
    } catch (error) {
      responderError(res, error);
    }
  });

  // GET /auth/me (autenticado)
  router.get("/auth/me", authMiddleware, async (req, res) => {
    try {
      if (!req.usuario) {
        res.status(401).json({ codigo: "no_autenticado", mensaje: "No autenticado" });
        return;
      }
      const usuario = await deps.obtenerUsuarioAutenticadoUseCase.ejecutar(req.usuario.id);
      res.status(200).json(usuario);
    } catch (error) {
      responderError(res, error);
    }
  });

  // GET /usuarios (supervisor, administrativo, administrador)
  router.get(
    "/usuarios",
    authMiddleware,
    exigirRol("supervisor", "administrativo", "administrador"),
    async (req, res) => {
      try {
        const filtro = UsuariosFiltro.parse(req.query);
        const usuarios = await deps.listarUsuariosUseCase.ejecutar(filtro);
        res.status(200).json(usuarios);
      } catch (error) {
        responderError(res, error);
      }
    },
  );

  // POST /usuarios (administrador)
  router.post("/usuarios", authMiddleware, exigirRol("administrador"), async (req, res) => {
    try {
      const cuerpo = UsuarioCrear.parse(req.body);
      const usuario = await deps.crearUsuarioUseCase.ejecutar(cuerpo);
      res.status(201).json(usuario);
    } catch (error) {
      responderError(res, error);
    }
  });

  return router;
}
