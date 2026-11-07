import React, { useEffect, useState } from "react";
import type {
  Actividad,
  Asignacion,
  MiProgramacion,
  RegistroJornadaSolicitud,
  TipoEvidencia,
  Usuario,
} from "@plomada/shared";
import { clienteApi } from "../infrastructure/api/cliente-api";
import {
  db,
  type EvidenciaLocal,
  type RegistroJornadaLocal,
} from "../infrastructure/storage/dexie-db";
import { motorSincronizacion } from "../services/motor-sincronizacion";
import { comprimirFoto } from "../utils/compresion-foto";

function calcularLunesSemana(fechaReferencia: Date = new Date()): string {
  const dia = fechaReferencia.getUTCDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(fechaReferencia);
  lunes.setUTCDate(fechaReferencia.getUTCDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

function cambiarSemanas(semanaLunes: string, cantidadSemanas: number): string {
  const f = new Date(semanaLunes + "T00:00:00Z");
  f.setUTCDate(f.getUTCDate() + cantidadSemanas * 7);
  return f.toISOString().slice(0, 10);
}

function calcularViernesSemana(semanaLunes: string): string {
  const f = new Date(semanaLunes + "T00:00:00Z");
  f.setUTCDate(f.getUTCDate() + 4);
  return f.toISOString().slice(0, 10);
}

function traducirError(errorMsg?: string): string {
  if (!errorMsg) return "Error desconocido al sincronizar";
  if (errorMsg.includes("413") || errorMsg.includes("tamano_excedido")) {
    return "La fotografía supera el tamaño máximo permitido por el servidor (413).";
  }
  if (errorMsg.includes("422") || errorMsg.includes("validacion")) {
    return "Los datos no cumplen con las reglas de validación del servidor (422).";
  }
  if (errorMsg.includes("415")) {
    return "Formato de archivo no soportado por el servidor (415).";
  }
  if (errorMsg.includes("403") || errorMsg.includes("sin_permiso")) {
    return "No tienes permiso para registrar esta acción (403).";
  }
  if (errorMsg.includes("404") || errorMsg.includes("no_encontrado")) {
    return "El recurso o actividad no existe en el servidor (404).";
  }
  if (errorMsg.includes("409") || errorMsg.includes("conflicto")) {
    return "Conflicto con un registro previo en el servidor (409).";
  }
  return errorMsg;
}

function renderBadgeSincronizacion(
  estado: "pendiente" | "sincronizado" | "error",
) {
  switch (estado) {
    case "sincronizado":
      return (
        <span className="badge badge-exito" style={{ fontSize: "0.65rem" }}>
          Subido
        </span>
      );
    case "error":
      return (
        <span className="badge badge-peligro" style={{ fontSize: "0.65rem" }}>
          Fallido
        </span>
      );
    case "pendiente":
    default:
      return (
        <span className="badge badge-alerta" style={{ fontSize: "0.65rem" }}>
          En cola
        </span>
      );
  }
}

interface Props {
  usuario: Usuario;
}

export const OperarioDashboard: React.FC<Props> = ({ usuario }) => {
  const [semanaConsultada, setSemanaConsultada] = useState<string>(
    calcularLunesSemana(),
  );
  const [programacion, setProgramacion] = useState<MiProgramacion | null>(null);
  const [diaSeleccionadoIndex, setDiaSeleccionadoIndex] = useState(0);
  const [actividadParaFoto, setActividadParaFoto] = useState<Actividad | null>(
    null,
  );
  const [tipoEvidencia, setTipoEvidencia] = useState<TipoEvidencia>("antes");
  const [registrosJornada, setRegistrosJornada] = useState<
    RegistroJornadaLocal[]
  >([]);
  const [evidenciasLocales, setEvidenciasLocales] = useState<EvidenciaLocal[]>(
    [],
  );
  const [comprimiendo, setComprimiendo] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  useEffect(() => {
    cargarProgramacion();
    cargarRegistrosLocales();

    const desuscribir = motorSincronizacion.suscribir(() => {
      void cargarRegistrosLocales();
    });

    return desuscribir;
  }, []);

  const seleccionarDiaRelevante = (asigs: Asignacion[]) => {
    if (!asigs || asigs.length === 0) return;
    const hoyStr = new Date().toISOString().slice(0, 10);
    const indexHoy = asigs.findIndex((a) => a.fecha === hoyStr);
    setDiaSeleccionadoIndex(indexHoy >= 0 ? indexHoy : 0);
  };

  const cargarProgramacion = async (semana?: string) => {
    const semanaABuscar = semana ?? semanaConsultada;
    try {
      const cached = await db.miProgramacion.get(semanaABuscar);
      if (cached) {
        setProgramacion({
          semanaInicio: cached.semanaInicio,
          asignaciones: cached.asignaciones,
        });
        seleccionarDiaRelevante(cached.asignaciones);
      }

      if (navigator.onLine) {
        const prog = await clienteApi.obtenerMiProgramacion(semana);
        setProgramacion(prog);
        setSemanaConsultada(prog.semanaInicio);
        seleccionarDiaRelevante(prog.asignaciones);
      }
    } catch (err) {
      console.warn(
        "No se pudo actualizar programación del servidor, usando local:",
        err,
      );
    }
  };

  const cargarRegistrosLocales = async () => {
    const j = await db.registrosJornadaLocales
      .where("operarioId")
      .equals(usuario.id)
      .reverse()
      .sortBy("ocurridoEn");
    setRegistrosJornada(j);

    const ev = await db.evidenciasLocales
      .where("operarioId")
      .equals(usuario.id)
      .reverse()
      .sortBy("capturadaEn");
    setEvidenciasLocales(ev);
  };

  const handleMarcarJornada = async (solicitud: RegistroJornadaSolicitud) => {
    try {
      await motorSincronizacion.registrarJornada(usuario.id, solicitud);
      await cargarRegistrosLocales();
      mostrarMensaje(
        `Evento "${formatearTipoJornada(solicitud.tipo)}" registrado`,
      );
    } catch (err) {
      alert("Error al registrar jornada: " + (err as Error).message);
    }
  };

  const handleCapturarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo || !actividadParaFoto) return;

    setComprimiendo(true);
    try {
      const resultado = await comprimirFoto(archivo);

      await motorSincronizacion.registrarEvidencia({
        actividadId: actividadParaFoto.id,
        operarioId: usuario.id,
        tipo: tipoEvidencia,
        blob: resultado.blob,
        tamanoBytes: resultado.tamanoBytes,
      });

      await cargarRegistrosLocales();
      setActividadParaFoto(null);
      mostrarMensaje(
        `Foto (${tipoEvidencia}) guardada (${Math.round(resultado.tamanoBytes / 1024)} KB)`,
      );
    } catch (err) {
      alert("Error al procesar la fotografía: " + (err as Error).message);
    } finally {
      setComprimiendo(false);
      e.target.value = "";
    }
  };

  const mostrarMensaje = (msg: string) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(null), 4000);
  };

  const formatearTipoJornada = (tipo: string): string => {
    switch (tipo) {
      case "entrada_centro":
        return "Entrada al centro";
      case "salida_centro":
        return "Salida del centro";
      case "inicio_actividad":
        return "Inicio actividad";
      case "fin_actividad":
        return "Fin actividad";
      default:
        return tipo;
    }
  };

  const handleReintentar = async (
    id: string,
    tipo: "jornada" | "evidencia",
  ) => {
    try {
      await motorSincronizacion.reintentarElemento(id, tipo);
      await cargarRegistrosLocales();
      mostrarMensaje("Reintentando sincronización...");
    } catch (err) {
      alert("Error al reintentar: " + (err as Error).message);
    }
  };

  const handleDescartar = async (id: string, tipo: "jornada" | "evidencia") => {
    const confirmado = window.confirm(
      "¿Estás seguro de descartar este elemento? Se eliminará de la cola y no se enviará al servidor.",
    );
    if (!confirmado) return;

    try {
      await motorSincronizacion.descartarElemento(id, tipo);
      await cargarRegistrosLocales();
      mostrarMensaje("Elemento descartado correctamente");
    } catch (err) {
      alert("Error al descartar elemento: " + (err as Error).message);
    }
  };

  const asignaciones = programacion?.asignaciones ?? [];
  const asignacionActual: Asignacion | undefined =
    asignaciones[diaSeleccionadoIndex];

  const jornadasFallidas = registrosJornada.filter(
    (r) => r.estadoSincronizacion === "error",
  );
  const evidenciasFallidas = evidenciasLocales.filter(
    (e) => e.estadoSincronizacion === "error",
  );
  const totalFallidos = jornadasFallidas.length + evidenciasFallidas.length;

  return (
    <div
      className="contenedor"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {mensajeExito && (
        <div
          style={{
            backgroundColor: "#dcfce7",
            color: "#166534",
            padding: "0.75rem",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontWeight: "500",
          }}
        >
          {mensajeExito}
        </div>
      )}

      {/* SECCIÓN DE AVISO DE ELEMENTOS FALLIDOS (C-3 / D7) */}
      {totalFallidos > 0 && (
        <section
          className="tarjeta"
          style={{
            borderLeft: "4px solid #ef4444",
            backgroundColor: "#fef2f2",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: "700",
                color: "#991b1b",
                margin: 0,
              }}
            >
              ⚠ Elementos pendientes de atención ({totalFallidos})
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                color: "#b91c1c",
                fontWeight: "500",
              }}
            >
              Requieren revisión
            </span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#7f1d1d", margin: 0 }}>
            Los siguientes elementos no pudieron enviarse al servidor debido a
            un error. Puedes reintentar el envío o descartarlos si ya no
            corresponden.
          </p>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {jornadasFallidas.map((j) => (
              <div
                key={j.id}
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  padding: "0.6rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "600",
                      fontSize: "0.85rem",
                      color: "#1e293b",
                    }}
                  >
                    Jornada: {formatearTipoJornada(j.solicitud.tipo)}
                  </span>
                  <span
                    className="badge badge-peligro"
                    style={{ fontSize: "0.65rem" }}
                  >
                    Fallido
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#b91c1c" }}>
                  <strong>Motivo:</strong> {traducirError(j.errorDetalle)}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.2rem",
                  }}
                >
                  <button
                    onClick={() => void handleReintentar(j.id, "jornada")}
                    className="btn-primario"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                  >
                    Reintentar
                  </button>
                  <button
                    onClick={() => void handleDescartar(j.id, "jornada")}
                    className="btn-secundario"
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.6rem",
                      color: "#dc2626",
                      borderColor: "#fca5a5",
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ))}

            {evidenciasFallidas.map((ev) => (
              <div
                key={ev.id}
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  padding: "0.6rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "600",
                      fontSize: "0.85rem",
                      color: "#1e293b",
                    }}
                  >
                    Foto ({ev.tipo}) - {Math.round(ev.tamanoBytes / 1024)} KB
                  </span>
                  <span
                    className="badge badge-peligro"
                    style={{ fontSize: "0.65rem" }}
                  >
                    Fallido
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#b91c1c" }}>
                  <strong>Motivo:</strong> {traducirError(ev.errorDetalle)}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.2rem",
                  }}
                >
                  <button
                    onClick={() => void handleReintentar(ev.id, "evidencia")}
                    className="btn-primario"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                  >
                    Reintentar
                  </button>
                  <button
                    onClick={() => void handleDescartar(ev.id, "evidencia")}
                    className="btn-secundario"
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.6rem",
                      color: "#dc2626",
                      borderColor: "#fca5a5",
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECCIÓN 1: CONTROL DE JORNADA */}
      <section
        className="tarjeta"
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
          Control de Horario en Centro
        </h2>

        {asignacionActual ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
            }}
          >
            <button
              onClick={() =>
                void handleMarcarJornada({
                  tipo: "entrada_centro",
                  centroTrabajoId: asignacionActual.centroTrabajo.id,
                  capturadoEn: new Date().toISOString(),
                })
              }
              className="btn-primario"
              style={{ padding: "0.75rem 0.5rem", fontSize: "0.9rem" }}
            >
              📍 Entrada al Centro
            </button>
            <button
              onClick={() =>
                void handleMarcarJornada({
                  tipo: "salida_centro",
                  centroTrabajoId: asignacionActual.centroTrabajo.id,
                  capturadoEn: new Date().toISOString(),
                })
              }
              className="btn-primario"
              style={{
                padding: "0.75rem 0.5rem",
                fontSize: "0.9rem",
                backgroundColor: "#334155",
              }}
            >
              🏁 Salida del Centro
            </button>
          </div>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Selecciona una asignación para registrar jornada.
          </p>
        )}

        {registrosJornada.length > 0 && (
          <div
            style={{
              marginTop: "0.5rem",
              borderTop: "1px solid var(--color-borde)",
              paddingTop: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                fontWeight: "600",
              }}
            >
              Últimos eventos registrados:
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
                marginTop: "0.3rem",
              }}
            >
              {registrosJornada.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.8rem",
                    padding: "0.2rem 0",
                  }}
                >
                  <span>{formatearTipoJornada(r.solicitud.tipo)}</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>
                      {new Date(r.ocurridoEn).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {renderBadgeSincronizacion(r.estadoSincronizacion)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECCIÓN 2: PROGRAMACIÓN SEMANAL Y ACTIVIDADES */}
      <section
        className="tarjeta"
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: "700",
                color: "#0f172a",
                margin: 0,
              }}
            >
              Programación Semanal
            </h2>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
            >
              <button
                type="button"
                onClick={() => {
                  const ant = cambiarSemanas(semanaConsultada, -1);
                  setSemanaConsultada(ant);
                  void cargarProgramacion(ant);
                }}
                className="btn-secundario"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              >
                ◀ Ant
              </button>
              <button
                type="button"
                onClick={() => {
                  const hoySemana = calcularLunesSemana();
                  setSemanaConsultada(hoySemana);
                  void cargarProgramacion(hoySemana);
                }}
                className="btn-secundario"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => {
                  const sig = cambiarSemanas(semanaConsultada, 1);
                  setSemanaConsultada(sig);
                  void cargarProgramacion(sig);
                }}
                className="btn-secundario"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              >
                Sig ▶
              </button>
            </div>
          </div>
          <div
            style={{ fontSize: "0.8rem", color: "#0284c7", fontWeight: "600" }}
          >
            📅 Semana del Lunes {semanaConsultada} al Viernes{" "}
            {calcularViernesSemana(semanaConsultada)}
          </div>
        </div>

        {asignaciones.length > 0 ? (
          <>
            <div
              style={{
                display: "flex",
                gap: "0.3rem",
                overflowX: "auto",
                paddingBottom: "0.4rem",
              }}
            >
              {asignaciones.map((asig, idx) => {
                const activo = idx === diaSeleccionadoIndex;
                const fechaObj = new Date(`${asig.fecha}T00:00:00Z`);
                const nombreDia = fechaObj.toLocaleDateString("es-CO", {
                  weekday: "short",
                  timeZone: "UTC",
                });

                return (
                  <button
                    key={asig.id}
                    onClick={() => setDiaSeleccionadoIndex(idx)}
                    style={{
                      flex: "1 0 auto",
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.8rem",
                      borderRadius: "6px",
                      backgroundColor: activo
                        ? "var(--color-primario)"
                        : "#e2e8f0",
                      color: activo ? "#ffffff" : "#334155",
                      fontWeight: activo ? "600" : "normal",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ textTransform: "capitalize" }}>
                      {nombreDia}
                    </div>
                    <div style={{ fontSize: "0.7rem", opacity: 0.9 }}>
                      {asig.fecha.slice(5)}
                    </div>
                  </button>
                );
              })}
            </div>

            {asignacionActual && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  marginTop: "0.2rem",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid var(--color-borde)",
                    borderRadius: "6px",
                    padding: "0.6rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      color: "#1e293b",
                    }}
                  >
                    🏢 {asignacionActual.centroTrabajo.nombre}
                  </div>
                  {asignacionActual.centroTrabajo.direccion && (
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      📍 {asignacionActual.centroTrabajo.direccion}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "#475569",
                    }}
                  >
                    Actividades ({asignacionActual.actividades.length}):
                  </span>

                  {asignacionActual.actividades.map((act) => {
                    const fotosDeEstaActividad = evidenciasLocales.filter(
                      (e) => e.actividadId === act.id,
                    );

                    return (
                      <div
                        key={act.id}
                        style={{
                          border: "1px solid var(--color-borde)",
                          borderRadius: "6px",
                          padding: "0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: "500",
                              flex: 1,
                            }}
                          >
                            {act.descripcion}
                          </span>
                          <span
                            className={`badge ${
                              act.estado === "aprobada" ||
                              act.estado === "finalizada"
                                ? "badge-exito"
                                : act.estado === "en_curso"
                                  ? "badge-info"
                                  : act.estado === "rechazada"
                                    ? "badge-peligro"
                                    : "badge-alerta"
                            }`}
                          >
                            {act.estado}
                          </span>
                        </div>

                        {/* Botones de actividad */}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.4rem",
                            alignItems: "center",
                          }}
                        >
                          <button
                            onClick={() =>
                              void handleMarcarJornada({
                                tipo: "inicio_actividad",
                                actividadId: act.id,
                                capturadoEn: new Date().toISOString(),
                              })
                            }
                            className="btn-secundario"
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.3rem 0.6rem",
                            }}
                          >
                            ▶ Iniciar
                          </button>
                          <button
                            onClick={() =>
                              void handleMarcarJornada({
                                tipo: "fin_actividad",
                                actividadId: act.id,
                                capturadoEn: new Date().toISOString(),
                              })
                            }
                            className="btn-secundario"
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.3rem 0.6rem",
                            }}
                          >
                            ⏹ Finalizar
                          </button>
                          <button
                            onClick={() => setActividadParaFoto(act)}
                            className="btn-primario"
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.3rem 0.6rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                            }}
                          >
                            📷 Tomar evidencia
                          </button>

                          {fotosDeEstaActividad.length > 0 && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "#0284c7",
                                marginLeft: "auto",
                              }}
                            >
                              {fotosDeEstaActividad.length} foto(s)
                            </span>
                          )}
                        </div>

                        {fotosDeEstaActividad.length > 0 && (
                          <div
                            style={{
                              marginTop: "0.3rem",
                              borderTop: "1px dashed var(--color-borde)",
                              paddingTop: "0.3rem",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "#64748b",
                                fontWeight: "600",
                              }}
                            >
                              Evidencias capturadas:
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                              }}
                            >
                              {fotosDeEstaActividad.map((foto) => (
                                <div
                                  key={foto.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: "0.75rem",
                                    backgroundColor: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "4px",
                                  }}
                                >
                                  <span>
                                    📷 Foto ({foto.tipo}) -{" "}
                                    {Math.round(foto.tamanoBytes / 1024)} KB
                                  </span>
                                  {renderBadgeSincronizacion(
                                    foto.estadoSincronizacion,
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "#334155",
                fontWeight: "600",
                fontSize: "0.9rem",
                margin: "0 0 0.4rem 0",
              }}
            >
              No tienes actividades asignadas para la semana del{" "}
              {semanaConsultada}.
            </p>
            <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>
              Si tu coordinador te asignó labores recientemente para otra fecha,
              usa los botones <strong>◀ Ant</strong> o <strong>Sig ▶</strong>{" "}
              para cambiar de semana. Recuerda además que la programación debe
              haber sido <strong>publicada</strong> por el coordinador para ser
              visible.
            </p>
          </div>
        )}
      </section>

      {/* MODAL / PANEL DE CAPTURA DE FOTOGRAFÍA */}
      {actividadParaFoto && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div
            className="tarjeta"
            style={{
              width: "100%",
              maxWidth: "400px",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                Capturar Evidencia
              </h3>
              <button
                onClick={() => setActividadParaFoto(null)}
                style={{
                  background: "transparent",
                  fontSize: "1.2rem",
                  padding: "0.2rem",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#475569" }}>
              Actividad: <strong>{actividadParaFoto.descripcion}</strong>
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              <label style={{ fontSize: "0.85rem", fontWeight: "600" }}>
                Tipo de evidencia:
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.4rem",
                }}
              >
                {(["antes", "durante", "despues"] as TipoEvidencia[]).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoEvidencia(t)}
                      style={{
                        padding: "0.5rem",
                        fontSize: "0.8rem",
                        textTransform: "capitalize",
                        backgroundColor:
                          tipoEvidencia === t
                            ? "var(--color-primario)"
                            : "#e2e8f0",
                        color: tipoEvidencia === t ? "#ffffff" : "#1e293b",
                        fontWeight: tipoEvidencia === t ? "600" : "normal",
                      }}
                    >
                      {t}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "1.5rem",
                  border: "2px dashed var(--color-primario)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor: "#f0f9ff",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "2rem" }}>📸</span>
                <span
                  style={{
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    color: "var(--color-primario)",
                  }}
                >
                  {comprimiendo
                    ? "Comprimiendo imagen..."
                    : "Abrir Cámara o Galería"}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#64748b",
                    marginTop: "0.2rem",
                  }}
                >
                  Se comprime automáticamente en el celular (~400 KB)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void handleCapturarFoto(e)}
                  disabled={comprimiendo}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
