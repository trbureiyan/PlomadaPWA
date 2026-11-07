import {
  PREFIJO_API,
  rutas,
  type ActividadDetalle,
  type ActividadResumen,
  type ActividadesFiltro,
  type CentroTrabajo,
  type CentroTrabajoCrear,
  type Evidencia,
  type HojaDeVida,
  type HojaDeVidaGuardar,
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
    let mensaje = `API Error ${status} [${codigo}]`;
    if (detalle && typeof detalle === "object") {
      const d = detalle as {
        mensaje?: string;
        campos?: Array<{ campo: string; mensaje: string }>;
      };
      if (d.campos && d.campos.length > 0) {
        const erroresCampos = d.campos.map((c) => `${c.campo}: ${c.mensaje}`).join(", ");
        mensaje = `Error de validación (${status}): ${erroresCampos}`;
      } else if (d.mensaje) {
        mensaje = d.mensaje;
      }
    }
    super(mensaje);
    this.name = "ApiError";
  }
}

export type EsquemaRespuesta<T> =
  | {
      safeParse(data: unknown): {
        success: boolean;
        data?: unknown;
        error?: { message: string; issues?: Array<{ path?: PropertyKey[]; message: string }> };
      };
    }
  | "binario";

async function parsearJsonSeguro(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json();
  } catch (err) {
    throw new Error(
      `Respuesta no válida del servidor (no es JSON válido o portal cautivo): ${(err as Error).message}`,
    );
  }
}

function validarConEsquema<T>(datos: unknown, esquema: EsquemaRespuesta<T>): T {
  if (esquema === "binario") {
    return datos as T;
  }
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    const issues = resultado.error?.issues;
    const detalle =
      issues && issues.length > 0
        ? issues
            .map((i) => {
              const p = i.path ? i.path.map(String).join(".") : "";
              return p ? `${p}: ${i.message}` : i.message;
            })
            .join(", ")
        : (resultado.error?.message ?? "Error de validación con el esquema");
    throw new Error(`Respuesta no cumple el esquema del contrato: ${detalle}`);
  }
  return resultado.data as T;
}

let renovandoPromise: Promise<string | null> | null = null;

async function renovarTokenSesion(): Promise<string | null> {
  if (renovandoPromise) return renovandoPromise;

  renovandoPromise = (async () => {
    try {
      const sesion = await db.sesion.get("activa");
      if (!sesion?.refreshToken) return null;

      let res: Response;
      try {
        res = await fetch(`${PREFIJO_API}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: sesion.refreshToken }),
        });
      } catch {
        return null;
      }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          await db.sesion.delete("activa");
        }
        return null;
      }

      const json = await parsearJsonSeguro(res);
      const data = validarConEsquema<SesionRespuesta>(json, rutas.renovarSesion.respuesta);
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
  esquema?: EsquemaRespuesta<T>,
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
      return peticionApi<T>(ruta, { ...opciones, headers }, false, esquema);
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
    if (esquema && esquema !== "binario") {
      return validarConEsquema<T>({}, esquema);
    }
    return {} as T;
  }

  const json = await parsearJsonSeguro(respuesta);
  if (esquema) {
    return validarConEsquema<T>(json, esquema);
  }
  return json as T;
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
      rutas.iniciarSesion.respuesta,
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
    return peticionApi<Usuario>("/auth/me", {}, true, rutas.miUsuario.respuesta);
  },

  async cerrarSesion(): Promise<void> {
    await db.sesion.delete("activa");
  },

  async obtenerMiProgramacion(semanaInicio?: string): Promise<MiProgramacion> {
    const query = semanaInicio ? `?semanaInicio=${semanaInicio}` : "";
    const prog = await peticionApi<MiProgramacion>(
      `/mi-programacion${query}`,
      {},
      true,
      rutas.miProgramacion.respuesta,
    );
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
    return peticionApi<RegistroJornada>(
      `/registros-jornada/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(solicitud),
      },
      true,
      rutas.registrarJornada.respuesta,
    );
  },

  async subirEvidencia(
    id: string,
    actividadId: string,
    tipo: TipoEvidencia,
    capturadaEn: string,
    archivoBlob: Blob,
  ): Promise<Evidencia> {
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

    let respuesta: Response;
    try {
      respuesta = await fetch(`${PREFIJO_API}/evidencias/${id}`, {
        method: "PUT",
        headers,
        body: formData,
      });
    } catch (error) {
      throw new Error(`Fallo de red o servidor inaccesible: ${(error as Error).message}`);
    }

    if (respuesta.status === 401 && sesion?.refreshToken) {
      const nuevoToken = await renovarTokenSesion();
      if (nuevoToken) {
        headers["Authorization"] = `Bearer ${nuevoToken}`;
        let reintento: Response;
        try {
          reintento = await fetch(`${PREFIJO_API}/evidencias/${id}`, {
            method: "PUT",
            headers,
            body: formData,
          });
        } catch (error) {
          throw new Error(`Fallo de red o servidor inaccesible: ${(error as Error).message}`);
        }
        if (!reintento.ok) {
          let codigo = "error_subida_evidencia";
          let detalle: unknown;
          try {
            const errJson = await reintento.json();
            codigo = errJson.codigo || codigo;
            detalle = errJson;
          } catch {
            // Ignorar si no es JSON
          }
          throw new ApiError(reintento.status, codigo, detalle);
        }
        const jsonReintento = await parsearJsonSeguro(reintento);
        return validarConEsquema(jsonReintento, rutas.subirEvidencia.respuesta);
      }
    }

    if (!respuesta.ok) {
      let codigo = "error_subida_evidencia";
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

    const json = await parsearJsonSeguro(respuesta);
    return validarConEsquema(json, rutas.subirEvidencia.respuesta);
  },

  async listarActividadesSupervisor(filtro?: ActividadesFiltro): Promise<ActividadResumen[]> {
    const params = new URLSearchParams();
    if (filtro?.revision) params.append("revision", filtro.revision);
    if (filtro?.fecha) params.append("fecha", filtro.fecha);
    if (filtro?.centroTrabajoId) params.append("centroTrabajoId", filtro.centroTrabajoId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return peticionApi<ActividadResumen[]>(
      `/actividades${qs}`,
      {},
      true,
      rutas.listarActividades.respuesta,
    );
  },

  async obtenerActividadDetalle(id: string): Promise<ActividadDetalle> {
    return peticionApi<ActividadDetalle>(
      `/actividades/${id}`,
      {},
      true,
      rutas.obtenerActividad.respuesta,
    );
  },

  async revisarActividad(
    id: string,
    resultado: ResultadoRevision,
    observacion?: string,
  ): Promise<Revision> {
    return peticionApi<Revision>(
      `/actividades/${id}/revision`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultado, observacion }),
      },
      true,
      rutas.revisarActividad.respuesta,
    );
  },

  async obtenerSeguimientoDia(fecha: string, centroTrabajoId?: string): Promise<SeguimientoDia> {
    const params = new URLSearchParams({ fecha });
    if (centroTrabajoId) params.append("centroTrabajoId", centroTrabajoId);
    return peticionApi<SeguimientoDia>(
      `/seguimiento/dia?${params.toString()}`,
      {},
      true,
      rutas.seguimientoDia.respuesta,
    );
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
    return peticionApi<Usuario[]>(
      `/usuarios${qs}`,
      {},
      true,
      rutas.listarUsuarios.respuesta,
    );
  },

  async crearUsuario(datos: UsuarioCrear): Promise<Usuario> {
    return peticionApi<Usuario>(
      "/usuarios",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      },
      true,
      rutas.crearUsuario.respuesta,
    );
  },

  async listarCentrosTrabajo(): Promise<CentroTrabajo[]> {
    return peticionApi<CentroTrabajo[]>(
      "/centros-trabajo",
      {},
      true,
      rutas.listarCentros.respuesta,
    );
  },

  async crearCentroTrabajo(datos: CentroTrabajoCrear): Promise<CentroTrabajo> {
    return peticionApi<CentroTrabajo>(
      "/centros-trabajo",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      },
      true,
      rutas.crearCentro.respuesta,
    );
  },

  async listarProgramaciones(filtro?: ProgramacionesFiltro): Promise<ProgramacionSemanal[]> {
    const params = new URLSearchParams();
    if (filtro?.semanaInicio) params.append("semanaInicio", filtro.semanaInicio);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return peticionApi<ProgramacionSemanal[]>(
      `/programaciones${qs}`,
      {},
      true,
      rutas.listarProgramaciones.respuesta,
    );
  },

  async obtenerProgramacion(id: string): Promise<ProgramacionSemanal> {
    return peticionApi<ProgramacionSemanal>(
      `/programaciones/${id}`,
      {},
      true,
      rutas.obtenerProgramacion.respuesta,
    );
  },

  async crearProgramacion(datos: ProgramacionCrear): Promise<ProgramacionSemanal> {
    return peticionApi<ProgramacionSemanal>(
      "/programaciones",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      },
      true,
      rutas.crearProgramacion.respuesta,
    );
  },

  async publicarProgramacion(id: string): Promise<ProgramacionSemanal> {
    return peticionApi<ProgramacionSemanal>(
      `/programaciones/${id}/publicar`,
      { method: "POST" },
      true,
      rutas.publicarProgramacion.respuesta,
    );
  },

  async listarRegistrosJornada(filtro?: RegistrosJornadaFiltro): Promise<RegistroJornada[]> {
    const params = new URLSearchParams();
    if (filtro?.fecha) params.append("fecha", filtro.fecha);
    if (filtro?.operarioId) params.append("operarioId", filtro.operarioId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return peticionApi<RegistroJornada[]>(
      `/registros-jornada${qs}`,
      {},
      true,
      rutas.listarRegistrosJornada.respuesta,
    );
  },

  async obtenerHojaDeVida(operarioId: string): Promise<HojaDeVida | null> {
    try {
      return await peticionApi<HojaDeVida>(
        `/operarios/${operarioId}/hoja-de-vida`,
        {},
        true,
        rutas.obtenerHojaDeVida.respuesta,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async guardarHojaDeVida(operarioId: string, datos: HojaDeVidaGuardar): Promise<HojaDeVida> {
    return peticionApi<HojaDeVida>(
      `/operarios/${operarioId}/hoja-de-vida`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      },
      true,
      rutas.guardarHojaDeVida.respuesta,
    );
  },
};
