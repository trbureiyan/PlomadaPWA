import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import multer from "multer";
import {
  ActividadesFiltro,
  EvidenciaCampos,
  Id,
  LIMITES_EVIDENCIA,
  RevisionSolicitud,
} from "@plomada/shared";
import { responderError } from "../../../../infrastructure/http/validation";
import type { ListarActividadesSupervisorUseCase } from "../../application/listar-actividades.use-case";
import type { ObtenerActividadDetalleUseCase } from "../../application/obtener-actividad-detalle.use-case";
import type { ObtenerFotoEvidenciaUseCase } from "../../application/obtener-foto-evidencia.use-case";
import type { RevisarActividadUseCase } from "../../application/revisar-actividad.use-case";
import type { SubirEvidenciaUseCase } from "../../application/subir-evidencia.use-case";
import {
  crearAuthMiddleware,
  exigirRol,
  type TokenVerifier,
} from "../../../../infrastructure/http/auth.middleware";

export interface DependenciasEvidenciasRouter {
  subirEvidenciaUseCase: SubirEvidenciaUseCase;
  obtenerFotoEvidenciaUseCase: ObtenerFotoEvidenciaUseCase;
  listarActividadesSupervisorUseCase: ListarActividadesSupervisorUseCase;
  obtenerActividadDetalleUseCase: ObtenerActividadDetalleUseCase;
  revisarActividadUseCase: RevisarActividadUseCase;
  tokenService: TokenVerifier;
}

export function crearEvidenciasRouter(
  deps: DependenciasEvidenciasRouter,
): Router {
  const router = Router();
  const auth = crearAuthMiddleware(deps.tokenService);
  const rolRevision = exigirRol(
    "supervisor",
    "administrativo",
    "administrador",
  );
  const rolSupervisor = exigirRol("supervisor");
  const rolOperario = exigirRol("operario");

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: LIMITES_EVIDENCIA.tamanoMaximoBytes,
    },
  });

  const middlewareUpload = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    upload.single(LIMITES_EVIDENCIA.campoArchivo)(req, res, (err) => {
      if (err) {
        if (
          err instanceof multer.MulterError &&
          err.code === "LIMIT_FILE_SIZE"
        ) {
          res.status(413).json({
            codigo: "archivo_invalido",
            mensaje: `El archivo supera el tamaño máximo permitido de 1.5 MB`,
          });
          return;
        }
        res.status(415).json({
          codigo: "archivo_invalido",
          mensaje: err.message,
        });
        return;
      }
      next();
    });
  };

  // PUT /evidencias/:id (operario)
  router.put(
    "/evidencias/:id",
    auth,
    rolOperario,
    middlewareUpload,
    async (req, res) => {
      try {
        const id = Id.parse(
          Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        );
        const campos = EvidenciaCampos.parse(req.body);

        if (!req.file) {
          res.status(422).json({
            codigo: "validacion",
            mensaje: "Se requiere el archivo de imagen en el campo foto",
          });
          return;
        }

        if (!req.usuario) {
          res
            .status(401)
            .json({ codigo: "no_autenticado", mensaje: "No autenticado" });
          return;
        }

        const resultado = await deps.subirEvidenciaUseCase.ejecutar({
          id,
          actividadId: campos.actividadId,
          operarioId: req.usuario.id,
          tipo: campos.tipo,
          capturadaEn: campos.capturadaEn,
          archivo: {
            buffer: req.file.buffer,
            tipoMime: req.file.mimetype,
            tamanoBytes: req.file.size,
          },
        });

        const statusHttp = resultado.esNuevo ? 201 : 200;
        res.status(statusHttp).json(resultado.evidencia);
      } catch (error) {
        responderError(res, error);
      }
    },
  );

  // GET /evidencias/:id/foto (operario, supervisor, administrativo, administrador)
  router.get(
    "/evidencias/:id/foto",
    auth,
    exigirRol("operario", "supervisor", "administrativo", "administrador"),
    async (req, res) => {
      try {
        const id = Id.parse(
          Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        );
        if (!req.usuario) {
          res
            .status(401)
            .json({ codigo: "no_autenticado", mensaje: "No autenticado" });
          return;
        }
        const foto = await deps.obtenerFotoEvidenciaUseCase.ejecutar(
          id,
          req.usuario,
        );

        res.setHeader("Content-Type", foto.tipoMime);
        res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
        res.status(200).send(foto.buffer);
      } catch (error) {
        responderError(res, error);
      }
    },
  );

  // GET /actividades (supervisor, administrativo, administrador)
  router.get("/actividades", auth, rolRevision, async (req, res) => {
    try {
      const filtro = ActividadesFiltro.parse(req.query);
      const actividades =
        await deps.listarActividadesSupervisorUseCase.ejecutar(filtro);
      res.status(200).json(actividades);
    } catch (error) {
      responderError(res, error);
    }
  });

  // GET /actividades/:id (supervisor, administrativo, administrador)
  router.get("/actividades/:id", auth, rolRevision, async (req, res) => {
    try {
      const id = Id.parse(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );
      const detalle = await deps.obtenerActividadDetalleUseCase.ejecutar(id);
      res.status(200).json(detalle);
    } catch (error) {
      responderError(res, error);
    }
  });

  // PUT /actividades/:id/revision (supervisor)
  router.put(
    "/actividades/:id/revision",
    auth,
    rolSupervisor,
    async (req, res) => {
      try {
        const id = Id.parse(
          Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        );
        const cuerpo = RevisionSolicitud.parse(req.body);

        if (!req.usuario) {
          res
            .status(401)
            .json({ codigo: "no_autenticado", mensaje: "No autenticado" });
          return;
        }

        const revision = await deps.revisarActividadUseCase.ejecutar(
          id,
          req.usuario.id,
          cuerpo,
        );
        res.status(200).json(revision);
      } catch (error) {
        responderError(res, error);
      }
    },
  );

  return router;
}
