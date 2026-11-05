import {
  PREFIJO_API,
  type ActividadDetalle,
  type ActividadResumen,
  type ActividadesFiltro,
  type CentroTrabajo,
  type CentroTrabajoCrear,
  type ProgramacionCrear,
  type ProgramacionSemanal,
  type ProgramacionesFiltro,
  type RegistrosJornadaFiltro,
  type SesionRespuesta,
  type MiProgramacion,
  type RegistroJornada,
  type RegistroJornadaSolicitud,
  type Revision,
  type ResultadoRevision,
  type SeguimientoDia,
  type TipoEvidencia,
  type Usuario,
  type UsuarioCrear,
  type UsuariosFiltro,
} from "@plomada/shared";
import { db } from "../storage/dexie-db";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    public readonly detalle?: unknown,
  ) {
    super(`API Error ${status} [${codigo}]`);
    this.name = "ApiError";
  }
}

let renovandoPromise: Promise<string | null> | null = null;

async function renovarTokenSesion(): Promise<string | null> {
  if (renovandoPromise) return renovandoPromise;

  renovandoPromise = (async () => {
    try {
      const sesion = await db.sesion.get("activa");
      if (!sesion?.refreshToken) return null;

      const res = await fetch(`${PREFIJO_API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: sesion.refreshToken }),
      });

      if (!res.ok) {
        await db.sesion.delete("activa");
        return null;
      }

      const data = (await res.json()) as SesionRespuesta;
      await db.sesion.update("activa", {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        usuario: data.usuario,
        guardadoEn: new Date().toISOString(),
      });
      return data.accessToken;
    } catch {
      return null;
    } finally {
      renovandoPromise = null;
    }
  })();

  return renovandoPromise;
}

export async function peticionApi<T>(
  ruta: string,
  opciones: RequestInit = {},
  reintentoPor401 = true,
): Promise<T> {
  const sesion = await db.sesion.get("activa");
  const headers = new Headers(opciones.headers || {});

  if (sesion?.accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${sesion.accessToken}`);
  }

  const url = ruta.startsWith("http") ? ruta : `${PREFIJO_API}${ruta}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      ...opciones,
      headers,
    });
  } catch (error) {
    throw new Error(`Fallo de red o servidor inaccesible: ${(error as Error).message}`);
  }

  if (respuesta.status === 401 && reintentoPor401 && sesion?.refreshToken) {
    const nuevoToken = await renovarTokenSesion();
    if (nuevoToken) {
      headers.set("Authorization", `Bearer ${nuevoToken}`);
      return peticionApi<T>(ruta, { ...opciones, headers }, false);
    }
  }

  if (!respuesta.ok) {
    let codigo = "error_desconocido";
    let detalle: unknown;
    try {
      const errJson = await respuesta.json();
      codigo = errJson.codigo || codigo;
      detalle = errJson;
    } catch {
      // Ignorar si no es JSON
    }
    throw new ApiError(respuesta.status, codigo, detalle);
  }

  if (respuesta.status === 204) {
    return {} as T;
  }

  return (await respuesta.json()) as T;
}

export const clienteApi = {
  async login(correo: string, contrasena: string): Promise<SesionRespuesta> {
    const res = await peticionApi<SesionRespuesta>(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, contrasena }),
      },
      false,
    );

    await db.sesion.put({
      clave: "activa",
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      usuario: res.usuario,
      guardadoEn: new Date().toISOString(),
    });

    return res;
  },

  async obtenerUsuarioActual(): Promise<Usuario> {
    return peticionApi<Usuario>("/auth/me");
  },

  async cerrarSesion(): Promise<void> {
    await db.sesion.delete("activa");
  },

  async obtenerMiProgramacion(semanaInicio?: string): Promise<MiProgramacion> {
    const query = semanaInicio ? `?semanaInicio=${semanaInicio}` : "";
    const prog = await peticionApi<MiProgramacion>(`/mi-programacion${query}`);
    // Cachear en Dexie para consulta offline
    await db.miProgramacion.put({
      semanaInicio: prog.semanaInicio,
      asignaciones: prog.asignaciones,
      guardadoEn: new Date().toISOString(),
    });
    return prog;
  },

  async subirRegistroJornada(
    id: string,
    solicitud: RegistroJornadaSolicitud,
  ): Promise<RegistroJornada> {
    return peticionApi<RegistroJornada>(`/registros-jornada/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(solicitud),
    });
  },

  async subirEvidencia(
    id: string,
    actividadId: string,
    tipo: TipoEvidencia,
    capturadaEn: string,
    archivoBlob: Blob,
  ): Promise<unknown> {
    const formData = new FormData();
    formData.append("actividadId", actividadId);
    formData.append("tipo", tipo);
    formData.append("capturadaEn", capturadaEn);
    formData.append("foto", archivoBlob, `${id}.jpg`);

    const sesion = await db.sesion.get("activa");
    const headers: Record<string, string> = {};
    if (sesion?.accessToken) {
      headers["Authorization"] = `Bearer ${sesion.accessToken}`;
    }

    const respuesta = await fetch(`${PREFIJO_API}/evidencias/${id}`, {
      method: "PUT",
      headers,
      body: formData,
    });

    if (respuesta.status === 401 && sesion?.refreshToken) {
      const nuevoToken = await renovarTokenSesion();
      if (nuevoToken) {
        headers["Authorization"] = `Bearer ${nuevoToken}`;
        const reintento = await fetch(`${PREFIJO_API}/evidencias/${id}`, {
          method: "PUT",
          headers,
          body: formData,
        });
        if (!reintento.ok) {
          throw new ApiError(reintento.status, "error_subida_evidencia");
        }
        return reintento.json();
      }
    }

    if (!respuesta.ok) {
      throw new ApiError(respuesta.status, "error_subida_evidencia");
    }

    return respuesta.json();
  },

  async listarActividadesSupervisor(filtro?: ActividadesFiltro): Promise<ActividadResumen[]> {
    const params = new URLSearchParams();
    if (filtro?.revision) params.append("revision", filtro.revision);
    if (filtro?.fecha) params.append("fecha", filtro.fecha);
    if (filtro?.centroTrabajoId) params.append("centroTrabajoId", filtro.centroTrabajoId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return peticionApi<ActividadResumen[]>(`/actividades${qs}`);
  },

  async obtenerActividadDetalle(id: string): Promise<ActividadDetalle> {
    return peticionApi<ActividadDetalle>(`/actividades/${id}`);
  },

  async revisarActividad(
    id: string,
    resultado: ResultadoRevision,
    observacion?: string,
  ): Promise<Revision> {
    return peticionApi<Revision>(`/actividades/${id}/revision`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultado, observacion }),
    });
  },

  async obtenerSeguimientoDia(fecha: string, centroTrabajoId?: string): Promise<SeguimientoDia> {
    const params = new URLSearchParams({ fecha });
    if (centroTrabajoId) params.append("centroTrabajoId", centroTrabajoId);
    return peticionApi<SeguimientoDia>(`/seguimiento/dia?${params.toString()}`);
  },

  async obtenerFotoBlob(evidenciaId: string): Promise<Blob> {
    const sesion = await db.sesion.get("activa");
    const headers = new Headers();
    if (sesion?.accessToken) {
      headers.set("Authorization", `Bearer ${sesion.accessToken}`);
    }

    let res = await fetch(`${PREFIJO_API}/evidencias/${evidenciaId}/foto`, {
      headers,
    });

    if (res.status === 401 && sesion?.refreshToken) {
      const nuevoToken = await renovarTokenSesion();
      if (nuevoToken) {
        headers.set("Authorization", `Bearer ${nuevoToken}`);
        res = await fetch(`${PREFIJO_API}/evidencias/${evidenciaId}/foto`, {
          headers,
        });
      }
    }

    if (!res.ok) {
      throw new ApiError(res.status, "error_cargar_foto");
    }

    return res.blob();
  },

  async listarUsuarios(filtro?: UsuariosFiltro): Promise<Usuario[]> {
    const params = new URLSearchParams();
    if (filtro?.rol) params.append("rol", filtro.rol);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return peticionApi<Usuario[]>(`/usuarios${qs}`);
  },

  async crearUsuario(datos: UsuarioCrear): Promise<Usuario> {
    return peticionApi<Usuario>("/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
  },

  async listarCentrosTrabajo(): Promise<CentroTrabajo[]> {
    return peticionApi<CentroTrabajo[]>("/centros-trabajo");
  },

  async crearCentroTrabajo(datos: CentroTrabajoCrear): Promise<CentroTrabajo> {
    return peticionApi<CentroTrabajo>("/centros-trabajo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
  },

  async listarProgramaciones(filtro?: ProgramacionesFiltro): Promise<ProgramacionSemanal[]> {
    const params = new URLSearchParams();
    if (filtro?.semanaInicio) params.append("semanaInicio", filtro.semanaInicio);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return peticionApi<ProgramacionSemanal[]>(`/programaciones${qs}`);
  },

  async obtenerProgramacion(id: string): Promise<ProgramacionSemanal> {
    return peticionApi<ProgramacionSemanal>(`/programaciones/${id}`);
  },

  async crearProgramacion(datos: ProgramacionCrear): Promise<ProgramacionSemanal> {
    return peticionApi<ProgramacionSemanal>("/programaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
  },

  async publicarProgramacion(id: string): Promise<ProgramacionSemanal> {
    return peticionApi<ProgramacionSemanal>(`/programaciones/${id}/publicar`, {
      method: "POST",
    });
  },

  async listarRegistrosJornada(filtro?: RegistrosJornadaFiltro): Promise<RegistroJornada[]> {
    const params = new URLSearchParams();
    if (filtro?.fecha) params.append("fecha", filtro.fecha);
    if (filtro?.operarioId) params.append("operarioId", filtro.operarioId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return peticionApi<RegistroJornada[]>(`/registros-jornada${qs}`);
  },
};
