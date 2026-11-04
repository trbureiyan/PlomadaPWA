import { z } from "zod";
import { LoginSolicitud, RefrescoSolicitud, SesionRespuesta } from "./auth";
import { Rol, Salud } from "./comunes";
import {
  ActividadDetalle,
  ActividadResumen,
  ActividadesFiltro,
  Evidencia,
  EvidenciaCampos,
  Revision,
  RevisionSolicitud,
} from "./evidencias";
import {
  RegistroJornada,
  RegistroJornadaSolicitud,
  RegistrosJornadaFiltro,
} from "./jornada";
import { HojaDeVida, HojaDeVidaGuardar } from "./personal";
import {
  CentroTrabajo,
  CentroTrabajoCrear,
  MiProgramacion,
  MiProgramacionFiltro,
  ProgramacionCrear,
  ProgramacionSemanal,
  ProgramacionesFiltro,
} from "./programacion";
import { SeguimientoDia, SeguimientoFiltro } from "./seguimiento";
import { Usuario, UsuarioCrear, UsuariosFiltro } from "./usuarios";

export type Metodo = "GET" | "POST" | "PUT";

// P0: necesario para la demostración. P1: completa el flujo del operario o
// del administrador. P2: queda diseñado y se implementa solo si sobra tiempo.
export type Prioridad = "P0" | "P1" | "P2";

export type Acceso = "publico" | "autenticado" | readonly Rol[];

export interface DefinicionRuta {
  metodo: Metodo;
  // Relativa a PREFIJO_API.
  ruta: string;
  acceso: Acceso;
  prioridad: Prioridad;
  // Cuerpo JSON; en un multipart, solo los campos de texto.
  solicitud?: z.ZodType;
  // Parámetros de consulta (?clave=valor).
  consulta?: z.ZodType;
  // Cuerpo de la respuesta exitosa. "binario" es la imagen de una foto.
  respuesta: z.ZodType | "binario";
}

const GESTION = ["administrador", "administrativo"] as const;
const REVISION = ["supervisor", ...GESTION] as const;

// Fuente de verdad del contrato. docs/contrato-api.md lo explica en prosa y
// una prueba falla si una ruta de aquí no aparece allá.
export const rutas = {
  salud: {
    metodo: "GET",
    ruta: "/salud",
    acceso: "publico",
    prioridad: "P0",
    respuesta: Salud,
  },
  iniciarSesion: {
    metodo: "POST",
    ruta: "/auth/login",
    acceso: "publico",
    prioridad: "P0",
    solicitud: LoginSolicitud,
    respuesta: SesionRespuesta,
  },
  renovarSesion: {
    metodo: "POST",
    ruta: "/auth/refresh",
    acceso: "publico",
    prioridad: "P0",
    solicitud: RefrescoSolicitud,
    respuesta: SesionRespuesta,
  },
  miUsuario: {
    metodo: "GET",
    ruta: "/auth/me",
    acceso: "autenticado",
    prioridad: "P0",
    respuesta: Usuario,
  },
  listarUsuarios: {
    metodo: "GET",
    ruta: "/usuarios",
    acceso: REVISION,
    prioridad: "P1",
    consulta: UsuariosFiltro,
    respuesta: z.array(Usuario),
  },
  crearUsuario: {
    metodo: "POST",
    ruta: "/usuarios",
    acceso: ["administrador"],
    prioridad: "P1",
    solicitud: UsuarioCrear,
    respuesta: Usuario,
  },
  listarCentros: {
    metodo: "GET",
    ruta: "/centros-trabajo",
    acceso: "autenticado",
    prioridad: "P1",
    respuesta: z.array(CentroTrabajo),
  },
  crearCentro: {
    metodo: "POST",
    ruta: "/centros-trabajo",
    acceso: GESTION,
    prioridad: "P1",
    solicitud: CentroTrabajoCrear,
    respuesta: CentroTrabajo,
  },
  crearProgramacion: {
    metodo: "POST",
    ruta: "/programaciones",
    acceso: GESTION,
    prioridad: "P0",
    solicitud: ProgramacionCrear,
    respuesta: ProgramacionSemanal,
  },
  listarProgramaciones: {
    metodo: "GET",
    ruta: "/programaciones",
    acceso: GESTION,
    prioridad: "P1",
    consulta: ProgramacionesFiltro,
    respuesta: z.array(ProgramacionSemanal),
  },
  obtenerProgramacion: {
    metodo: "GET",
    ruta: "/programaciones/:id",
    acceso: GESTION,
    prioridad: "P1",
    respuesta: ProgramacionSemanal,
  },
  publicarProgramacion: {
    metodo: "POST",
    ruta: "/programaciones/:id/publicar",
    acceso: GESTION,
    prioridad: "P0",
    respuesta: ProgramacionSemanal,
  },
  miProgramacion: {
    metodo: "GET",
    ruta: "/mi-programacion",
    acceso: ["operario"],
    prioridad: "P0",
    consulta: MiProgramacionFiltro,
    respuesta: MiProgramacion,
  },
  registrarJornada: {
    metodo: "PUT",
    ruta: "/registros-jornada/:id",
    acceso: ["operario"],
    prioridad: "P1",
    solicitud: RegistroJornadaSolicitud,
    respuesta: RegistroJornada,
  },
  listarRegistrosJornada: {
    metodo: "GET",
    ruta: "/registros-jornada",
    acceso: REVISION,
    prioridad: "P1",
    consulta: RegistrosJornadaFiltro,
    respuesta: z.array(RegistroJornada),
  },
  subirEvidencia: {
    metodo: "PUT",
    ruta: "/evidencias/:id",
    acceso: ["operario"],
    prioridad: "P0",
    solicitud: EvidenciaCampos,
    respuesta: Evidencia,
  },
  fotoEvidencia: {
    metodo: "GET",
    ruta: "/evidencias/:id/foto",
    acceso: ["operario", ...REVISION],
    prioridad: "P0",
    respuesta: "binario",
  },
  listarActividades: {
    metodo: "GET",
    ruta: "/actividades",
    acceso: REVISION,
    prioridad: "P0",
    consulta: ActividadesFiltro,
    respuesta: z.array(ActividadResumen),
  },
  obtenerActividad: {
    metodo: "GET",
    ruta: "/actividades/:id",
    acceso: REVISION,
    prioridad: "P0",
    respuesta: ActividadDetalle,
  },
  revisarActividad: {
    metodo: "PUT",
    ruta: "/actividades/:id/revision",
    acceso: ["supervisor"],
    prioridad: "P0",
    solicitud: RevisionSolicitud,
    respuesta: Revision,
  },
  obtenerHojaDeVida: {
    metodo: "GET",
    ruta: "/operarios/:id/hoja-de-vida",
    acceso: REVISION,
    prioridad: "P2",
    respuesta: HojaDeVida,
  },
  guardarHojaDeVida: {
    metodo: "PUT",
    ruta: "/operarios/:id/hoja-de-vida",
    acceso: GESTION,
    prioridad: "P2",
    solicitud: HojaDeVidaGuardar,
    respuesta: HojaDeVida,
  },
  seguimientoDia: {
    metodo: "GET",
    ruta: "/seguimiento/dia",
    acceso: REVISION,
    prioridad: "P2",
    consulta: SeguimientoFiltro,
    respuesta: SeguimientoDia,
  },
} as const satisfies Record<string, DefinicionRuta>;

export type NombreRuta = keyof typeof rutas;
