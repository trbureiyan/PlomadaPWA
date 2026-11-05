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
import { db, type EvidenciaLocal, type RegistroJornadaLocal } from "../infrastructure/storage/dexie-db";
import { motorSincronizacion } from "../services/motor-sincronizacion";
import { comprimirFoto } from "../utils/compresion-foto";

interface Props {
  usuario: Usuario;
}

export const OperarioDashboard: React.FC<Props> = ({ usuario }) => {
  const [programacion, setProgramacion] = useState<MiProgramacion | null>(null);
  const [diaSeleccionadoIndex, setDiaSeleccionadoIndex] = useState(0);
  const [actividadParaFoto, setActividadParaFoto] = useState<Actividad | null>(null);
  const [tipoEvidencia, setTipoEvidencia] = useState<TipoEvidencia>("antes");
  const [registrosJornada, setRegistrosJornada] = useState<RegistroJornadaLocal[]>([]);
  const [evidenciasLocales, setEvidenciasLocales] = useState<EvidenciaLocal[]>([]);
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

  const cargarProgramacion = async () => {
    try {
      const cached = await db.miProgramacion.toCollection().first();
      if (cached) {
        setProgramacion({
          semanaInicio: cached.semanaInicio,
          asignaciones: cached.asignaciones,
        });
      }

      if (navigator.onLine) {
        const prog = await clienteApi.obtenerMiProgramacion();
        setProgramacion(prog);
      }
    } catch (err) {
      console.warn("No se pudo actualizar programación del servidor, usando local:", err);
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
      mostrarMensaje(`Evento "${formatearTipoJornada(solicitud.tipo)}" registrado`);
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
      mostrarMensaje(`Foto (${tipoEvidencia}) guardada (${Math.round(resultado.tamanoBytes / 1024)} KB)`);
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

  const asignaciones = programacion?.asignaciones ?? [];
  const asignacionActual: Asignacion | undefined = asignaciones[diaSeleccionadoIndex];

  return (
    <div className="contenedor" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

      {/* SECCIÓN 1: CONTROL DE JORNADA */}
      <section className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
          Control de Horario en Centro
        </h2>

        {asignacionActual ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
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
          <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--color-borde)", paddingTop: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
              Últimos eventos registrados:
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.3rem" }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ color: "#64748b" }}>
                      {new Date(r.ocurridoEn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span
                      className={`badge ${r.estadoSincronizacion === "sincronizado" ? "badge-exito" : "badge-alerta"}`}
                      style={{ fontSize: "0.65rem" }}
                    >
                      {r.estadoSincronizacion === "sincronizado" ? "Subido" : "En cola"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECCIÓN 2: PROGRAMACIÓN SEMANAL Y ACTIVIDADES */}
      <section className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
            Programación de la Semana
          </h2>
          {programacion && (
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Semana del {programacion.semanaInicio}
            </span>
          )}
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
                      backgroundColor: activo ? "var(--color-primario)" : "#e2e8f0",
                      color: activo ? "#ffffff" : "#334155",
                      fontWeight: activo ? "600" : "normal",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ textTransform: "capitalize" }}>{nombreDia}</div>
                    <div style={{ fontSize: "0.7rem", opacity: 0.9 }}>{asig.fecha.slice(5)}</div>
                  </button>
                );
              })}
            </div>

            {asignacionActual && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.2rem" }}>
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid var(--color-borde)",
                    borderRadius: "6px",
                    padding: "0.6rem",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1e293b" }}>
                    🏢 {asignacionActual.centroTrabajo.nombre}
                  </div>
                  {asignacionActual.centroTrabajo.direccion && (
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      📍 {asignacionActual.centroTrabajo.direccion}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#475569" }}>
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontSize: "0.9rem", fontWeight: "500", flex: 1 }}>
                            {act.descripcion}
                          </span>
                          <span
                            className={`badge ${
                              act.estado === "aprobada" || act.estado === "finalizada"
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                          <button
                            onClick={() =>
                              void handleMarcarJornada({
                                tipo: "inicio_actividad",
                                actividadId: act.id,
                                capturadoEn: new Date().toISOString(),
                              })
                            }
                            className="btn-secundario"
                            style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
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
                            style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
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
                            <span style={{ fontSize: "0.75rem", color: "#0284c7", marginLeft: "auto" }}>
                              {fotosDeEstaActividad.length} foto(s)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: "#64748b", fontSize: "0.9rem", textAlign: "center", padding: "1rem" }}>
            No hay programación asignada para esta semana.
          </p>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>Capturar Evidencia</h3>
              <button
                onClick={() => setActividadParaFoto(null)}
                style={{ background: "transparent", fontSize: "1.2rem", padding: "0.2rem" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#475569" }}>
              Actividad: <strong>{actividadParaFoto.descripcion}</strong>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "600" }}>Tipo de evidencia:</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                {(["antes", "durante", "despues"] as TipoEvidencia[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipoEvidencia(t)}
                    style={{
                      padding: "0.5rem",
                      fontSize: "0.8rem",
                      textTransform: "capitalize",
                      backgroundColor: tipoEvidencia === t ? "var(--color-primario)" : "#e2e8f0",
                      color: tipoEvidencia === t ? "#ffffff" : "#1e293b",
                      fontWeight: tipoEvidencia === t ? "600" : "normal",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
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
                <span style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--color-primario)" }}>
                  {comprimiendo ? "Comprimiendo imagen..." : "Abrir Cámara o Galería"}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
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
