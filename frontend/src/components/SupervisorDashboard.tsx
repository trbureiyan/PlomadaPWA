import React, { useEffect, useState } from "react";
import {
  PREFIJO_API,
  type ActividadDetalle,
  type ActividadResumen,
  type ResultadoRevision,
  type Usuario,
} from "@plomada/shared";
import { clienteApi } from "../infrastructure/api/cliente-api";
import { FotoProtegida } from "./FotoProtegida";

interface Props {
  usuario: Usuario;
}

export const SupervisorDashboard: React.FC<Props> = () => {
  const [actividades, setActividades] = useState<ActividadResumen[]>([]);
  const [filtroRevision, setFiltroRevision] = useState<"pendiente" | "todas">("pendiente");
  const [cargando, setCargando] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState<ActividadDetalle | null>(null);
  const [observacion, setObservacion] = useState("");
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    void cargarActividades();
  }, [filtroRevision]);

  const cargarActividades = async () => {
    setCargando(true);
    try {
      const filtro = filtroRevision === "pendiente" ? { revision: "pendiente" as const } : undefined;
      const res = await clienteApi.listarActividadesSupervisor(filtro);
      setActividades(res);
    } catch (err) {
      console.error("Error al cargar actividades:", err);
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

      {/* HEADER DE REVISIÓN */}
      <section className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700" }}>Cola de Supervisión</h2>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button
              onClick={() => setFiltroRevision("pendiente")}
              style={{
                fontSize: "0.75rem",
                padding: "0.3rem 0.6rem",
                backgroundColor: filtroRevision === "pendiente" ? "var(--color-primario)" : "#e2e8f0",
                color: filtroRevision === "pendiente" ? "#ffffff" : "#1e293b",
              }}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFiltroRevision("todas")}
              style={{
                fontSize: "0.75rem",
                padding: "0.3rem 0.6rem",
                backgroundColor: filtroRevision === "todas" ? "var(--color-primario)" : "#e2e8f0",
                color: filtroRevision === "todas" ? "#ffffff" : "#1e293b",
              }}
            >
              Todas
            </button>
          </div>
        </div>

        {cargando && <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Cargando actividades...</p>}

        {!cargando && actividades.length === 0 && (
          <p style={{ fontSize: "0.85rem", color: "#64748b", textAlign: "center", padding: "1rem" }}>
            No hay actividades {filtroRevision === "pendiente" ? "pendientes de revisión" : "registradas"}.
          </p>
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
