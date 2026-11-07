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
  PgProgramacionRepository,
  PublicarProgramacionUseCase,
  crearProgramacionRouter,
  derivarEstado,
  type HechosActividad,
  type HechosDeActividadPort,
} from "./modules/programacion";

// Módulo Evidencias
import {
  DiscoAlmacenamientoEvidencias,
  ListarActividadesSupervisorUseCase,
  ObtenerActividadDetalleUseCase,
  ObtenerFotoEvidenciaUseCase,
  PgEvidenciaRepository,
  PgRevisionRepository,
  RevisarActividadUseCase,
  SubirEvidenciaUseCase,
  crearEvidenciasRouter,
  type ActividadInfo,
  type ConsultaActividadPort,
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
  crearSeguimientoRouter,
  type ProveedorSeguimientoPort,
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

  // Implementación del puerto HechosDeActividadPort (según ADR 010)
  const hechosDeActividadPort: HechosDeActividadPort = {
    async obtenerHechosPorActividadId(actividadId: string): Promise<HechosActividad> {
      const jornadaRegistros = await jornadaRepo.listarPorActividadId(actividadId);
      const evidencias = await evidenciaRepo.listarPorActividadId(actividadId);
      const revision = await revisionRepo.buscarPorActividadId(actividadId);

      return {
        tieneInicio: jornadaRegistros.some((r) => r.tipo === "inicio_actividad"),
        tieneFin: jornadaRegistros.some((r) => r.tipo === "fin_actividad"),
        evidencias: evidencias.map((e) => ({ tipo: e.tipo })),
        revision: revision ? { resultado: revision.resultado } : undefined,
      };
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

  // 4. Adaptador ConsultaActividadPort para Evidencias
  const consultaActividadPort: ConsultaActividadPort = {
    async buscarActividad(id: string): Promise<ActividadInfo | null> {
      const sql = `
        SELECT act.id, act.descripcion, asig.operario_id, u.nombre as operario_nombre,
               asig.centro_trabajo_id, c.nombre as centro_trabajo_nombre, c.direccion as centro_trabajo_direccion,
               asig.fecha::text as fecha
        FROM actividades act
        JOIN asignaciones asig ON asig.id = act.asignacion_id
        JOIN usuarios u ON u.id = asig.operario_id
        JOIN centros_trabajo c ON c.id = asig.centro_trabajo_id
        WHERE act.id = $1
      `;
      const res = await pool.query<{
        id: string;
        descripcion: string;
        operario_id: string;
        operario_nombre: string;
        centro_trabajo_id: string;
        centro_trabajo_nombre: string;
        centro_trabajo_direccion: string | null;
        fecha: string;
      }>(sql, [id]);

      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        descripcion: r.descripcion,
        operarioId: r.operario_id,
        operarioNombre: r.operario_nombre,
        centroTrabajoId: r.centro_trabajo_id,
        centroTrabajoNombre: r.centro_trabajo_nombre,
        centroTrabajoDireccion: r.centro_trabajo_direccion ?? undefined,
        fecha: r.fecha,
      };
    },

    async listarActividades(filtro?: { fecha?: string; centroTrabajoId?: string }): Promise<ActividadInfo[]> {
      let sql = `
        SELECT act.id, act.descripcion, asig.operario_id, u.nombre as operario_nombre,
               asig.centro_trabajo_id, c.nombre as centro_trabajo_nombre, c.direccion as centro_trabajo_direccion,
               asig.fecha::text as fecha
        FROM actividades act
        JOIN asignaciones asig ON asig.id = act.asignacion_id
        JOIN usuarios u ON u.id = asig.operario_id
        JOIN centros_trabajo c ON c.id = asig.centro_trabajo_id
        WHERE 1=1
      `;
      const params: unknown[] = [];
      if (filtro?.fecha) {
        params.push(filtro.fecha);
        sql += ` AND asig.fecha = $${params.length}`;
      }
      if (filtro?.centroTrabajoId) {
        params.push(filtro.centroTrabajoId);
        sql += ` AND asig.centro_trabajo_id = $${params.length}`;
      }
      sql += " ORDER BY asig.fecha ASC, c.nombre ASC, act.descripcion ASC";

      const res = await pool.query<{
        id: string;
        descripcion: string;
        operario_id: string;
        operario_nombre: string;
        centro_trabajo_id: string;
        centro_trabajo_nombre: string;
        centro_trabajo_direccion: string | null;
        fecha: string;
      }>(sql, params);

      return res.rows.map((r) => ({
        id: r.id,
        descripcion: r.descripcion,
        operarioId: r.operario_id,
        operarioNombre: r.operario_nombre,
        centroTrabajoId: r.centro_trabajo_id,
        centroTrabajoNombre: r.centro_trabajo_nombre,
        centroTrabajoDireccion: r.centro_trabajo_direccion ?? undefined,
        fecha: r.fecha,
      }));
    },
  };

  const subirEvidenciaUseCase = new SubirEvidenciaUseCase(evidenciaRepo, almacenamientoEvidencias, consultaActividadPort);
  const obtenerFotoEvidenciaUseCase = new ObtenerFotoEvidenciaUseCase(evidenciaRepo, almacenamientoEvidencias);
  const listarActividadesSupervisorUseCase = new ListarActividadesSupervisorUseCase(
    consultaActividadPort,
    evidenciaRepo,
    revisionRepo,
  );
  const obtenerActividadDetalleUseCase = new ObtenerActividadDetalleUseCase(
    consultaActividadPort,
    evidenciaRepo,
    revisionRepo,
  );
  const revisarActividadUseCase = new RevisarActividadUseCase(consultaActividadPort, evidenciaRepo, revisionRepo);

  // 5. Casos de Uso de Jornada
  const registrarJornadaUseCase = new RegistrarJornadaUseCase(jornadaRepo);
  const listarRegistrosJornadaUseCase = new ListarRegistrosJornadaUseCase(jornadaRepo);

  // 6. Casos de Uso de Personal (P2)
  const hojaDeVidaRepo = new PgHojaDeVidaRepository(pool);
  const obtenerHojaDeVidaUseCase = new ObtenerHojaDeVidaUseCase(hojaDeVidaRepo);
  const guardarHojaDeVidaUseCase = new GuardarHojaDeVidaUseCase(hojaDeVidaRepo);

  // 7. Casos de Uso de Seguimiento (P2)
  const proveedorSeguimiento: ProveedorSeguimientoPort = {
    async obtenerSeguimiento(fecha: string) {
      const operarios = await usuarioRepo.listar({ rol: "operario" });
      const asignacionesRes = await pool.query<{
        operario_id: string;
        centro_trabajo_id: string;
        centro_trabajo_nombre: string;
        centro_trabajo_direccion: string | null;
        actividad_id: string;
        actividad_descripcion: string;
      }>(
        `SELECT asig.operario_id, asig.centro_trabajo_id, c.nombre as centro_trabajo_nombre, c.direccion as centro_trabajo_direccion,
                act.id as actividad_id, act.descripcion as actividad_descripcion
         FROM asignaciones asig
         JOIN centros_trabajo c ON c.id = asig.centro_trabajo_id
         JOIN actividades act ON act.asignacion_id = asig.id
         JOIN programaciones_semanales p ON p.id = asig.programacion_id
         WHERE asig.fecha = $1 AND p.estado = 'publicada'`,
        [fecha],
      );

      const todasActividadesIds = asignacionesRes.rows.map((r) => r.actividad_id);
      const hechosMap = await hechosDeActividadPort.obtenerHechosPorActividadesIds(todasActividadesIds);

      const jornadasDelDia = await jornadaRepo.listar({ fecha });

      const seguimientoOperarios = operarios.map((op) => {
        const rowsOp = asignacionesRes.rows.filter((r) => r.operario_id === op.id);
        const centro = rowsOp.length > 0
          ? {
              id: rowsOp[0].centro_trabajo_id,
              nombre: rowsOp[0].centro_trabajo_nombre,
              direccion: rowsOp[0].centro_trabajo_direccion ?? undefined,
            }
          : null;

        const jornadasOp = jornadasDelDia.filter((j) => j.operarioId === op.id);
        const entrada = jornadasOp.find((j) => j.tipo === "entrada_centro");
        const salida = jornadasOp.slice().reverse().find((j) => j.tipo === "salida_centro");

        const actividades = rowsOp.map((r) => {
          const hechos = hechosMap.get(r.actividad_id) ?? {};
          return {
            id: r.actividad_id,
            descripcion: r.actividad_descripcion,
            estado: derivarEstado(hechos),
            evidenciasRecibidas: hechos.evidencias?.length ?? 0,
          };
        });

        return {
          operario: { id: op.id, nombre: op.nombre },
          centroTrabajo: centro,
          entradaEn: entrada?.capturadoEn ?? null,
          salidaEn: salida?.capturadoEn ?? null,
          actividades,
        };
      });

      return {
        fecha,
        generadoEn: new Date().toISOString(),
        operarios: seguimientoOperarios,
      };
    },
  };

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
