import React, { useEffect, useState } from "react";
import type {
  ActividadDetalle,
  ActividadResumen,
  RegistroJornada,
  ResultadoRevision,
  SeguimientoDia,
  Usuario,
} from "@plomada/shared";
import { clienteApi } from "../infrastructure/api/cliente-api";
import { FotoProtegida } from "./FotoProtegida";

interface Props {
  usuario: Usuario;
}

type TabSupervisor = "cola" | "seguimiento" | "horario";
type FiltroRevision = "pendiente" | "revisada" | "todas";

export const SupervisorDashboard: React.FC<Props> = () => {
  const [tabActiva, setTabActiva] = useState<TabSupervisor>("cola");
  const [actividades, setActividades] = useState<ActividadResumen[]>([]);
  const [filtroRevision, setFiltroRevision] = useState<FiltroRevision>("pendiente");
  const [cargando, setCargando] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState<ActividadDetalle | null>(null);
  const [observacion, setObservacion] = useState("");
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Estado para Seguimiento y Control de Horario
  const [fechaFiltro, setFechaFiltro] = useState(() => new Date().toISOString().slice(0, 10));
  const [seguimiento, setSeguimiento] = useState<SeguimientoDia | null>(null);
  const [registrosJornada, setRegistrosJornada] = useState<RegistroJornada[]>([]);

  useEffect(() => {
    if (tabActiva === "cola") {
      void cargarActividades();
    } else if (tabActiva === "seguimiento" || tabActiva === "horario") {
      void cargarSeguimientoYHorario();
    }
  }, [tabActiva, filtroRevision]);

  const cargarActividades = async () => {
    setCargando(true);
    try {
      const filtro =
        filtroRevision === "pendiente"
          ? { revision: "pendiente" as const }
          : filtroRevision === "revisada"
            ? { revision: "revisada" as const }
            : undefined;
      const res = await clienteApi.listarActividadesSupervisor(filtro);
      setActividades(res);
    } catch (err) {
      console.error("Error al cargar actividades:", err);
    } finally {
      setCargando(false);
    }
  };

  const cargarSeguimientoYHorario = async () => {
    setCargando(true);
    try {
      const [seg, reg] = await Promise.all([
        clienteApi.obtenerSeguimientoDia(fechaFiltro).catch(() => null),
        clienteApi.listarRegistrosJornada({ fecha: fechaFiltro }).catch(() => []),
      ]);
      setSeguimiento(seg);
      setRegistrosJornada(reg);
    } catch (err) {
      console.error("Error al cargar seguimiento u horario:", err);
    } finally {
      setCargando(false);
    }
  };

  const verDetalle = async (id: string) => {
    setCargando(true);
    try {
      const detalle = await clienteApi.obtenerActividadDetalle(id);
      setActividadSeleccionada(detalle);
      setObservacion(detalle.revision?.observacion || "");
    } catch (err) {
      alert("Error al cargar detalle de actividad: " + (err as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const handleRevisar = async (resultado: ResultadoRevision) => {
    if (!actividadSeleccionada) return;

    if (resultado === "rechazada" && !observacion.trim()) {
      alert("Un rechazo exige una observación obligatoria.");
      return;
    }

    setEnviandoRevision(true);
    try {
      await clienteApi.revisarActividad(
        actividadSeleccionada.id,
        resultado,
        observacion.trim() || undefined,
      );

      setMensaje(`Actividad marcada como ${resultado.toUpperCase()} exitosamente.`);
      setTimeout(() => setMensaje(null), 4000);

      setActividadSeleccionada(null);
      void cargarActividades();
    } catch (err) {
      alert("Error al guardar revisión: " + (err as Error).message);
    } finally {
      setEnviandoRevision(false);
    }
  };

  return (
    <div className="contenedor" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {mensaje && (
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
          {mensaje}
        </div>
      )}

      {/* PESTAÑAS PRINCIPALES DEL SUPERVISOR */}
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "2px solid #e2e8f0",
          overflowX: "auto",
          paddingBottom: "0.25rem",
        }}
      >
        <button
          onClick={() => setTabActiva("cola")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: "600",
            fontSize: "0.9rem",
            color: tabActiva === "cola" ? "#0284c7" : "#64748b",
            borderBottom: tabActiva === "cola" ? "3px solid #0284c7" : "3px solid transparent",
            background: "transparent",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            cursor: "pointer",
          }}
        >
          📋 Cola de Revisión
        </button>
        <button
          onClick={() => setTabActiva("seguimiento")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: "600",
            fontSize: "0.9rem",
            color: tabActiva === "seguimiento" ? "#0284c7" : "#64748b",
            borderBottom: tabActiva === "seguimiento" ? "3px solid #0284c7" : "3px solid transparent",
            background: "transparent",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            cursor: "pointer",
          }}
        >
          📊 Seguimiento Diario (CU-08)
        </button>
        <button
          onClick={() => setTabActiva("horario")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: "600",
            fontSize: "0.9rem",
            color: tabActiva === "horario" ? "#0284c7" : "#64748b",
            borderBottom: tabActiva === "horario" ? "3px solid #0284c7" : "3px solid transparent",
            background: "transparent",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            cursor: "pointer",
          }}
        >
          ⏱️ Control de Horario (CU-14)
        </button>
      </nav>

      {/* 1. TAB: COLA DE REVISIÓN */}
      {tabActiva === "cola" && (
        <section className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "700", margin: 0 }}>Cola de Supervisión</h2>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Inspección y calificación de actividades de campo
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button
                onClick={() => setFiltroRevision("pendiente")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  backgroundColor: filtroRevision === "pendiente" ? "var(--color-primario)" : "#e2e8f0",
                  color: filtroRevision === "pendiente" ? "#ffffff" : "#1e293b",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFiltroRevision("revisada")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  backgroundColor: filtroRevision === "revisada" ? "var(--color-primario)" : "#e2e8f0",
                  color: filtroRevision === "revisada" ? "#ffffff" : "#1e293b",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Revisadas
              </button>
              <button
                onClick={() => setFiltroRevision("todas")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  backgroundColor: filtroRevision === "todas" ? "var(--color-primario)" : "#e2e8f0",
                  color: filtroRevision === "todas" ? "#ffffff" : "#1e293b",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Todas
              </button>
            </div>
          </div>

          {cargando && <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Cargando actividades...</p>}

          {!cargando && actividades.length === 0 && (
            <div style={{ textAlign: "center", padding: "1.5rem", color: "#64748b", fontSize: "0.85rem" }}>
              {filtroRevision === "pendiente" ? (
                <>
                  <p style={{ margin: "0 0 0.4rem 0", fontWeight: "600", color: "#334155" }}>
                    No hay actividades pendientes de revisión.
                  </p>
                  <p style={{ margin: 0, fontSize: "0.8rem" }}>
                    Las actividades pendientes de revisión son aquellas que ya cuentan con al menos una evidencia fotográfica enviada por el operario y aún no han sido calificadas. Las actividades sin evidencia se encuentran en ejecución y pueden consultarse en <strong>Seguimiento Diario</strong> o en el filtro <strong>Todas</strong>.
                  </p>
                </>
              ) : filtroRevision === "revisada" ? (
                <p>No hay actividades revisadas aún.</p>
              ) : (
                <p>No hay actividades registradas en el sistema.</p>
              )}
            </div>
          )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {actividades.map((act) => (
            <div
              key={act.id}
              onClick={() => void verDetalle(act.id)}
              style={{
                border: "1px solid var(--color-borde)",
                borderRadius: "6px",
                padding: "0.75rem",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
                backgroundColor: "#ffffff",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "#0f172a" }}>
                  {act.descripcion}
                </span>
                <span
                  className={`badge ${
                    act.estado === "aprobada" || act.estado === "finalizada"
                      ? "badge-exito"
                      : act.estado === "rechazada"
                        ? "badge-peligro"
                        : "badge-alerta"
                  }`}
                >
                  {act.estado}
                </span>
              </div>

              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                👷 {act.operario.nombre} • 🏢 {act.centroTrabajo.nombre} • 📅 {act.fecha}
              </div>

              <div style={{ fontSize: "0.75rem", color: "#0284c7", fontWeight: "500" }}>
                {act.evidenciasRecibidas} foto(s) de evidencia
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* 2. TAB: SEGUIMIENTO DIARIO (CU-08) */}
      {tabActiva === "seguimiento" && (
        <section className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "700", margin: 0 }}>Seguimiento Diario (CU-08)</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
              />
              <button
                type="button"
                onClick={() => void cargarSeguimientoYHorario()}
                className="btn-primario"
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
              >
                Consultar
              </button>
            </div>
          </div>

          {cargando && <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Cargando datos de seguimiento...</p>}

          {!cargando && !seguimiento && (
            <p style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center" }}>
              No hay datos de seguimiento para la fecha seleccionada.
            </p>
          )}

          {!cargando && seguimiento && (() => {
            const totalActividades = seguimiento.operarios.reduce((acc, o) => acc + o.actividades.length, 0);
            const finalizadas = seguimiento.operarios.reduce(
              (acc, o) => acc + o.actividades.filter((a) => a.estado === "finalizada" || a.estado === "aprobada").length,
              0,
            );
            const porcentaje = totalActividades > 0 ? Math.round((finalizadas / totalActividades) * 100) : 0;
            const activos = seguimiento.operarios.filter((o) => o.entradaEn !== null).length;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem", textAlign: "center", backgroundColor: "#f8fafc" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Avance de la Jornada</span>
                    <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#0284c7" }}>{porcentaje}%</div>
                  </div>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem", textAlign: "center", backgroundColor: "#f8fafc" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Operarios Activos Hoy</span>
                    <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#0f172a" }}>{activos} / {seguimiento.operarios.length}</div>
                  </div>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem", textAlign: "center", backgroundColor: "#f8fafc" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Actividades Finalizadas</span>
                    <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#16a34a" }}>{finalizadas} / {totalActividades}</div>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                        <th style={{ padding: "0.5rem" }}>Operario</th>
                        <th style={{ padding: "0.5rem" }}>Centro de Trabajo</th>
                        <th style={{ padding: "0.5rem" }}>Actividades Asignadas</th>
                        <th style={{ padding: "0.5rem" }}>Entrada / Salida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seguimiento.operarios.map((op) => (
                        <tr key={op.operario.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.5rem", fontWeight: "600" }}>{op.operario.nombre}</td>
                          <td style={{ padding: "0.5rem", color: "#64748b" }}>{op.centroTrabajo?.nombre || "Sin asignar"}</td>
                          <td style={{ padding: "0.5rem" }}>
                            {op.actividades.length === 0 ? (
                              <span style={{ color: "#94a3b8" }}>Sin actividades</span>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                                {op.actividades.map((a) => (
                                  <li key={a.id} style={{ marginBottom: "0.2rem" }}>
                                    <span>{a.descripcion} </span>
                                    <span
                                      className={`badge ${
                                        a.estado === "aprobada"
                                          ? "badge-exito"
                                          : a.estado === "rechazada"
                                            ? "badge-peligro"
                                            : a.estado === "en_curso"
                                              ? "badge-alerta"
                                              : "badge-primario"
                                      }`}
                                      style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}
                                    >
                                      {a.estado}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td style={{ padding: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                            <div>In: {op.entradaEn ? new Date(op.entradaEn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Pendiente"}</div>
                            <div>Out: {op.salidaEn ? new Date(op.salidaEn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Pendiente"}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* 3. TAB: CONTROL DE HORARIO (CU-14) */}
      {tabActiva === "horario" && (
        <section className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "700", margin: 0 }}>Control de Horario (CU-14)</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
              />
              <button
                type="button"
                onClick={() => void cargarSeguimientoYHorario()}
                className="btn-primario"
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
              >
                Consultar
              </button>
            </div>
          </div>

          {cargando && <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Cargando registros de jornada...</p>}

          {!cargando && registrosJornada.length === 0 && (
            <p style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center" }}>
              No hay marcas de horario registradas para la fecha seleccionada.
            </p>
          )}

          {!cargando && registrosJornada.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                    <th style={{ padding: "0.5rem" }}>Tipo de Registro</th>
                    <th style={{ padding: "0.5rem" }}>Hora Celular (Capturada UTC)</th>
                    <th style={{ padding: "0.5rem" }}>Hora Servidor (Recibida UTC)</th>
                    <th style={{ padding: "0.5rem" }}>Diferencia Auditada</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosJornada.map((reg) => {
                    const tCap = new Date(reg.capturadoEn).getTime();
                    const tRec = new Date(reg.recibidoEn).getTime();
                    const diffMin = Math.round((tRec - tCap) / (1000 * 60));
                    return (
                      <tr key={reg.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.5rem", fontWeight: "600" }}>{reg.tipo}</td>
                        <td style={{ padding: "0.5rem" }}>{new Date(reg.capturadoEn).toLocaleTimeString()}</td>
                        <td style={{ padding: "0.5rem", color: "#64748b" }}>{new Date(reg.recibidoEn).toLocaleTimeString()}</td>
                        <td style={{ padding: "0.5rem" }}>
                          <span
                            className={`badge ${
                              Math.abs(diffMin) > 60
                                ? "badge-alerta"
                                : "badge-exito"
                            }`}
                          >
                            {diffMin > 0 ? `+${diffMin} min` : `${diffMin} min`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}


      {/* MODAL DETALLE DE ACTIVIDAD Y DECISIÓN */}
      {actividadSeleccionada && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
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
              maxWidth: "500px",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                  {actividadSeleccionada.descripcion}
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {actividadSeleccionada.operario.nombre} ({actividadSeleccionada.centroTrabajo.nombre})
                </span>
              </div>
              <button
                onClick={() => setActividadSeleccionada(null)}
                style={{ background: "transparent", fontSize: "1.2rem", padding: "0.2rem" }}
              >
                ✕
              </button>
            </div>

            {/* FOTOS DE EVIDENCIA */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "#334155" }}>
                Evidencias Fotográficas ({actividadSeleccionada.evidencias.length})
              </h4>

              {actividadSeleccionada.evidencias.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Esta actividad no tiene evidencias fotográficas subidas todavía.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {actividadSeleccionada.evidencias.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        border: "1px solid var(--color-borde)",
                        borderRadius: "6px",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "#f1f5f9",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          textTransform: "capitalize",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{ev.tipo}</span>
                        <span style={{ color: "#64748b" }}>
                          {new Date(ev.capturadaEn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <FotoProtegida
                        evidenciaId={ev.id}
                        alt={`Evidencia ${ev.tipo}`}
                        style={{
                          width: "100%",
                          height: "140px",
                          objectFit: "cover",
                          backgroundColor: "#e2e8f0",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORMULARIO DE REVISIÓN */}
            <div
              style={{
                borderTop: "1px solid var(--color-borde)",
                paddingTop: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "#334155" }}>
                Decisión de Supervisión
              </h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Observaciones (obligatorio si rechaza):
                </label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Escriba aquí los comentarios u observaciones..."
                  rows={2}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-borde)",
                    fontSize: "0.85rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  disabled={enviandoRevision || actividadSeleccionada.evidencias.length === 0}
                  onClick={() => void handleRevisar("aprobada")}
                  className="btn-exito"
                  style={{ padding: "0.6rem", fontSize: "0.85rem" }}
                >
                  ✓ Aprobar
                </button>
                <button
                  type="button"
                  disabled={enviandoRevision || actividadSeleccionada.evidencias.length === 0}
                  onClick={() => void handleRevisar("rechazada")}
                  className="btn-peligro"
                  style={{ padding: "0.6rem", fontSize: "0.85rem" }}
                >
                  ✕ Rechazar
                </button>
              </div>

              {actividadSeleccionada.evidencias.length === 0 && (
                <span style={{ fontSize: "0.75rem", color: "#b91c1c" }}>
                  * No se puede emitir revisión hasta que el operario suba al menos una evidencia.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
