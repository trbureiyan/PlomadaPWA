import express, { type Express } from "express";
import type pg from "pg";
import { PREFIJO_API } from "@plomada/shared";
import { obtenerPool } from "./infrastructure/database/pool";

// Módulo Identidad
import {
  Argon2PasswordHasher,
  CrearUsuarioUseCase,
  IniciarSesionUseCase,
  JoseTokenService,
  ListarUsuariosUseCase,
  ObtenerUsuarioAutenticadoUseCase,
  PgSesionRepository,
  PgUsuarioRepository,
  RenovarSesionUseCase,
  crearIdentidadRouter,
} from "./modules/identidad";

// Módulo Programación
import {
  CrearCentroTrabajoUseCase,
  CrearProgramacionUseCase,
  ListarCentrosTrabajoUseCase,
  ListarProgramacionesUseCase,
  NodemailerNotificadorProgramacion,
  ObtenerMiProgramacionUseCase,
  ObtenerProgramacionUseCase,
  PgCentroTrabajoRepository,
  PgConsultaProgramacion,
  PgProgramacionRepository,
  PublicarProgramacionUseCase,
  crearProgramacionRouter,
  type HechosActividad,
  type HechosDeActividadPort,
} from "./modules/programacion";

// Módulo Evidencias
import {
  ConsultaActividadDesdeProgramacion,
  DiscoAlmacenamientoEvidencias,
  ListarActividadesSupervisorUseCase,
  ObtenerActividadDetalleUseCase,
  ObtenerFotoEvidenciaUseCase,
  PgEvidenciaRepository,
  PgRevisionRepository,
  RevisarActividadUseCase,
  SubirEvidenciaUseCase,
  crearEvidenciasRouter,
} from "./modules/evidencias";

// Módulo Jornada
import {
  ListarRegistrosJornadaUseCase,
  PgRegistroJornadaRepository,
  RegistrarJornadaUseCase,
  crearJornadaRouter,
} from "./modules/jornada";

// Módulo Personal
import {
  GuardarHojaDeVidaUseCase,
  ObtenerHojaDeVidaUseCase,
  PgHojaDeVidaRepository,
  crearPersonalRouter,
} from "./modules/personal";

// Módulo Seguimiento
import {
  ObtenerSeguimientoDiaUseCase,
  ProveedorSeguimientoCompuesto,
  crearSeguimientoRouter,
} from "./modules/seguimiento";
import { leerSecretoJwt } from "./infrastructure/config/secreto-jwt";

export interface OpcionesApp {
  pool?: pg.Pool;
  jwtSecret?: string;
  jwtTtlMinutos?: number;
  fotosDir?: string;
}

export function crearApp(opciones: OpcionesApp = {}): { app: Express; pool: pg.Pool } {
  const pool = opciones.pool ?? obtenerPool();
  const jwtSecret = opciones.jwtSecret ?? leerSecretoJwt(process.env);
  const jwtTtl = opciones.jwtTtlMinutos ?? Number(process.env.JWT_ACCESS_TTL_MINUTOS ?? 15);
  const fotosDir = opciones.fotosDir ?? process.env.FOTOS_DIR ?? "./data/fotos";

  // 1. Adaptadores de Identidad
  const usuarioRepo = new PgUsuarioRepository(pool);
  const sesionRepo = new PgSesionRepository(pool);
  const passwordHasher = new Argon2PasswordHasher();
  const tokenService = new JoseTokenService(jwtSecret, jwtTtl);

  const iniciarSesionUseCase = new IniciarSesionUseCase(usuarioRepo, sesionRepo, passwordHasher, tokenService);
  const renovarSesionUseCase = new RenovarSesionUseCase(usuarioRepo, sesionRepo, tokenService);
  const obtenerUsuarioAutenticadoUseCase = new ObtenerUsuarioAutenticadoUseCase(usuarioRepo);
  const listarUsuariosUseCase = new ListarUsuariosUseCase(usuarioRepo);
  const crearUsuarioUseCase = new CrearUsuarioUseCase(usuarioRepo, passwordHasher);

  // 2. Adaptadores de Jornada y Evidencias para implementar HechosDeActividadPort
  const jornadaRepo = new PgRegistroJornadaRepository(pool);
  const evidenciaRepo = new PgEvidenciaRepository(pool);
  const revisionRepo = new PgRevisionRepository(pool);
  const almacenamientoEvidencias = new DiscoAlmacenamientoEvidencias(fotosDir);

  // Implementación del puerto HechosDeActividadPort (nota 010): cablea lo que exponen
  // jornada y evidencias. Un solo camino, el de varias actividades, para todas las consultas.
  const hechosDeActividadPort: HechosDeActividadPort = {
    async obtenerHechosPorActividadId(actividadId: string): Promise<HechosActividad> {
      const mapa = await this.obtenerHechosPorActividadesIds([actividadId]);
      return mapa.get(actividadId) ?? {};
    },

    async obtenerHechosPorActividadesIds(actividadesIds: string[]): Promise<Map<string, HechosActividad>> {
      const jornadaMap = await jornadaRepo.listarPorActividadesIds(actividadesIds);
      const evidenciasMap = await evidenciaRepo.listarPorActividadesIds(actividadesIds);
      const revisionesMap = await revisionRepo.buscarPorActividadesIds(actividadesIds);

      const resultado = new Map<string, HechosActividad>();
      for (const id of actividadesIds) {
        const jList = jornadaMap.get(id) ?? [];
        const eList = evidenciasMap.get(id) ?? [];
        const rev = revisionesMap.get(id);

        resultado.set(id, {
          tieneInicio: jList.some((r) => r.tipo === "inicio_actividad"),
          tieneFin: jList.some((r) => r.tipo === "fin_actividad"),
          evidencias: eList.map((e) => ({ tipo: e.tipo })),
          revision: rev ? { resultado: rev.resultado } : undefined,
        });
      }
      return resultado;
    },
  };

  // 3. Adaptadores y Casos de Uso de Programación
  const centroRepo = new PgCentroTrabajoRepository(pool);
  const programacionRepo = new PgProgramacionRepository(pool);
  const notificadorMail = new NodemailerNotificadorProgramacion();

  const crearCentroTrabajoUseCase = new CrearCentroTrabajoUseCase(centroRepo);
  const listarCentrosTrabajoUseCase = new ListarCentrosTrabajoUseCase(centroRepo);
  const crearProgramacionUseCase = new CrearProgramacionUseCase(programacionRepo, centroRepo);
  const obtenerProgramacionUseCase = new ObtenerProgramacionUseCase(programacionRepo, centroRepo, hechosDeActividadPort);
  const listarProgramacionesUseCase = new ListarProgramacionesUseCase(programacionRepo, obtenerProgramacionUseCase);

  const proveedorInfoOperarios = async (ids: string[]) => {
    const todos = await usuarioRepo.listar();
    const mapa = new Map(todos.filter((u) => ids.includes(u.id)).map((u) => [u.id, u]));
    return mapa;
  };

  const publicarProgramacionUseCase = new PublicarProgramacionUseCase(
    programacionRepo,
    obtenerProgramacionUseCase,
    notificadorMail,
    proveedorInfoOperarios,
  );
  const obtenerMiProgramacionUseCase = new ObtenerMiProgramacionUseCase(programacionRepo, obtenerProgramacionUseCase);

  // 4. Adaptador ConsultaActividadPort para Evidencias: programacion aporta las actividades
  // e identidad el nombre del operario.
  const consultaProgramacion = new PgConsultaProgramacion(pool);
  const consultaActividadPort = new ConsultaActividadDesdeProgramacion(consultaProgramacion, async (ids) => {
    const usuarios = await proveedorInfoOperarios(ids);
    return new Map([...usuarios].map(([id, u]) => [id, u.nombre]));
  });

  const subirEvidenciaUseCase = new SubirEvidenciaUseCase(evidenciaRepo, almacenamientoEvidencias, consultaActividadPort);
  const obtenerFotoEvidenciaUseCase = new ObtenerFotoEvidenciaUseCase(evidenciaRepo, almacenamientoEvidencias);
  const listarActividadesSupervisorUseCase = new ListarActividadesSupervisorUseCase(
    consultaActividadPort,
    hechosDeActividadPort,
  );
  const obtenerActividadDetalleUseCase = new ObtenerActividadDetalleUseCase(
    consultaActividadPort,
    evidenciaRepo,
    revisionRepo,
    hechosDeActividadPort,
  );
  const revisarActividadUseCase = new RevisarActividadUseCase(consultaActividadPort, evidenciaRepo, revisionRepo);

  // 5. Casos de Uso de Jornada
  const registrarJornadaUseCase = new RegistrarJornadaUseCase(jornadaRepo, consultaProgramacion);
  const listarRegistrosJornadaUseCase = new ListarRegistrosJornadaUseCase(jornadaRepo);

  // 6. Casos de Uso de Personal (P2)
  const hojaDeVidaRepo = new PgHojaDeVidaRepository(pool);
  const obtenerHojaDeVidaUseCase = new ObtenerHojaDeVidaUseCase(hojaDeVidaRepo);
  const guardarHojaDeVidaUseCase = new GuardarHojaDeVidaUseCase(hojaDeVidaRepo);

  // 7. Casos de Uso de Seguimiento (P2)
  const proveedorSeguimiento = new ProveedorSeguimientoCompuesto(
    async () => (await usuarioRepo.listar({ rol: "operario" })).map((u) => ({ id: u.id, nombre: u.nombre })),
    consultaProgramacion,
    hechosDeActividadPort,
    jornadaRepo,
  );

  const obtenerSeguimientoDiaUseCase = new ObtenerSeguimientoDiaUseCase(proveedorSeguimiento);

  // 8. Ensamblado de Express
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  // Endpoint de salud P0
  app.get(`${PREFIJO_API}/salud`, (_req, res) => {
    res.status(200).json({ estado: "ok", version: "0.1.0" });
  });

  // Conectar routers de cada módulo
  app.use(
    PREFIJO_API,
    crearIdentidadRouter({
      iniciarSesionUseCase,
      renovarSesionUseCase,
      obtenerUsuarioAutenticadoUseCase,
      listarUsuariosUseCase,
      crearUsuarioUseCase,
      tokenService,
    }),
  );

  app.use(
    PREFIJO_API,
    crearProgramacionRouter({
      crearCentroTrabajoUseCase,
      listarCentrosTrabajoUseCase,
      crearProgramacionUseCase,
      obtenerProgramacionUseCase,
      listarProgramacionesUseCase,
      publicarProgramacionUseCase,
      obtenerMiProgramacionUseCase,
      tokenService,
    }),
  );

  app.use(
    PREFIJO_API,
    crearEvidenciasRouter({
      subirEvidenciaUseCase,
      obtenerFotoEvidenciaUseCase,
      listarActividadesSupervisorUseCase,
      obtenerActividadDetalleUseCase,
      revisarActividadUseCase,
      tokenService,
    }),
  );

  app.use(
    PREFIJO_API,
    crearJornadaRouter({
      registrarJornadaUseCase,
      listarRegistrosJornadaUseCase,
      tokenService,
    }),
  );

  app.use(
    PREFIJO_API,
    crearPersonalRouter({
      obtenerHojaDeVidaUseCase,
      guardarHojaDeVidaUseCase,
      tokenService,
    }),
  );

  app.use(
    PREFIJO_API,
    crearSeguimientoRouter({
      obtenerSeguimientoDiaUseCase,
      tokenService,
    }),
  );

  return { app, pool };
}
