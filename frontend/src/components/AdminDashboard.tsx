import React, { useEffect, useState } from "react";
import type {
  ActividadDetalle,
  ActividadResumen,
  CentroTrabajo,
  ProgramacionSemanal,
  RegistroJornada,
  SeguimientoDia,
  Usuario,
} from "@plomada/shared";
import { clienteApi } from "../infrastructure/api/cliente-api";
import { FotoProtegida } from "./FotoProtegida";

interface Props {
  usuario: Usuario;
}

type TabAdmin = "usuarios" | "programacion" | "centros" | "seguimiento" | "auditoria";

export const AdminDashboard: React.FC<Props> = ({ usuario }) => {
  const esAdmin = usuario.rol === "administrador";
  const [tabActiva, setTabActiva] = useState<TabAdmin>(esAdmin ? "usuarios" : "programacion");

  // Estado Usuarios
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [nuevoRol, setNuevoRol] = useState<"operario" | "supervisor" | "administrativo" | "administrador">("operario");
  const [nuevaPassword, setNuevaPassword] = useState("Plomada2026!");
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  // Estado Centros
  const [centros, setCentros] = useState<CentroTrabajo[]>([]);
  const [nombreCentro, setNombreCentro] = useState("");
  const [direccionCentro, setDireccionCentro] = useState("");
  const [guardandoCentro, setGuardandoCentro] = useState(false);

  // Estado Programación
  const [programaciones, setProgramaciones] = useState<ProgramacionSemanal[]>([]);
  const [programacionSeleccionada, setProgramacionSeleccionada] = useState<ProgramacionSemanal | null>(null);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);

  // Estado Seguimiento y Jornada
  const [fechaFiltro, setFechaFiltro] = useState(() => new Date().toISOString().slice(0, 10));
  const [seguimiento, setSeguimiento] = useState<SeguimientoDia | null>(null);
  const [registrosJornada, setRegistrosJornada] = useState<RegistroJornada[]>([]);

  // Estado Auditoría de Actividades
  const [actividades, setActividades] = useState<ActividadResumen[]>([]);
  const [actividadSeleccionada, setActividadSeleccionada] = useState<ActividadDetalle | null>(null);

  // Mensajes de feedback
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const mostrarExito = (msg: string) => {
    setMensajeExito(msg);
    setMensajeError(null);
    setTimeout(() => setMensajeExito(null), 4000);
  };

  const mostrarError = (msg: string) => {
    setMensajeError(msg);
    setTimeout(() => setMensajeError(null), 5000);
  };

  // Carga inicial según pestaña
  useEffect(() => {
    cargarDatosTab(tabActiva);
  }, [tabActiva]);

  const cargarDatosTab = async (tab: TabAdmin) => {
    setCargando(true);
    setMensajeError(null);
    try {
      if (tab === "usuarios") {
        const u = await clienteApi.listarUsuarios();
        setUsuarios(u);
      } else if (tab === "centros") {
        const c = await clienteApi.listarCentrosTrabajo();
        setCentros(c);
      } else if (tab === "programacion") {
        const p = await clienteApi.listarProgramaciones();
        setProgramaciones(p);
        if (p.length > 0 && !programacionSeleccionada) {
          setProgramacionSeleccionada(p[0]);
        }
      } else if (tab === "seguimiento") {
        const [seg, reg] = await Promise.all([
          clienteApi.obtenerSeguimientoDia(fechaFiltro).catch(() => null),
          clienteApi.listarRegistrosJornada({ fecha: fechaFiltro }).catch(() => []),
        ]);
        setSeguimiento(seg);
        setRegistrosJornada(reg);
      } else if (tab === "auditoria") {
        const acts = await clienteApi.listarActividadesSupervisor();
        setActividades(acts);
      }
    } catch (err) {
      console.error(err);
      mostrarError((err as Error).message || "Error al cargar datos");
    } finally {
      setCargando(false);
    }
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim() || !nuevoCorreo.trim() || !nuevaPassword.trim()) {
      mostrarError("Completa todos los campos obligatorios");
      return;
    }
    setGuardandoUsuario(true);
    try {
      const creado = await clienteApi.crearUsuario({
        nombre: nuevoNombre.trim(),
        correo: nuevoCorreo.trim(),
        rol: nuevoRol,
        contrasenaInicial: nuevaPassword.trim(),
      });
      setUsuarios((prev) => [creado, ...prev]);
      setNuevoNombre("");
      setNuevoCorreo("");
      mostrarExito(`Usuario ${creado.nombre} (${creado.rol}) creado exitosamente`);
    } catch (err) {
      mostrarError((err as Error).message || "Error al crear usuario");
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const handleCrearCentro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCentro.trim()) {
      mostrarError("El nombre del centro es requerido");
      return;
    }
    setGuardandoCentro(true);
    try {
      const creado = await clienteApi.crearCentroTrabajo({
        nombre: nombreCentro.trim(),
        direccion: direccionCentro.trim() || undefined,
      });
      setCentros((prev) => [creado, ...prev]);
      setNombreCentro("");
      setDireccionCentro("");
      mostrarExito(`Centro de trabajo "${creado.nombre}" registrado exitosamente`);
    } catch (err) {
      mostrarError((err as Error).message || "Error al registrar centro");
    } finally {
      setGuardandoCentro(false);
    }
  };

  const handlePublicarProgramacion = async (id: string) => {
    setPublicandoId(id);
    try {
      const actualizada = await clienteApi.publicarProgramacion(id);
      setProgramaciones((prev) => prev.map((p) => (p.id === id ? actualizada : p)));
      if (programacionSeleccionada?.id === id) {
        setProgramacionSeleccionada(actualizada);
      }
      mostrarExito("Programación publicada. Se han disparado las notificaciones a los operarios.");
    } catch (err) {
      mostrarError((err as Error).message || "Error al publicar programación");
    } finally {
      setPublicandoId(null);
    }
  };

  const handleSeleccionarActividad = async (id: string) => {
    try {
      const det = await clienteApi.obtenerActividadDetalle(id);
      setActividadSeleccionada(det);
    } catch (err) {
      mostrarError((err as Error).message || "Error al abrir actividad");
    }
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "1rem" }}>
      {/* ENCABEZADO Y PESTAÑAS */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem 0", color: "#0f172a", fontSize: "1.4rem" }}>
          Panel de Administración y Gestión
        </h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
          {esAdmin
            ? "Gestión central de usuarios, centros, cronogramas y auditoría operativa."
            : "Coordinación de centros, programación semanal y seguimiento de avance."}
        </p>

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <nav
          style={{
            display: "flex",
            gap: "0.5rem",
            marginTop: "1rem",
            borderBottom: "2px solid #e2e8f0",
            overflowX: "auto",
            paddingBottom: "0.25rem",
          }}
        >
          {esAdmin && (
            <button
              onClick={() => setTabActiva("usuarios")}
              style={{
                padding: "0.6rem 1rem",
                fontWeight: "600",
                fontSize: "0.9rem",
                color: tabActiva === "usuarios" ? "#0284c7" : "#64748b",
                borderBottom: tabActiva === "usuarios" ? "3px solid #0284c7" : "3px solid transparent",
                background: "transparent",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                cursor: "pointer",
              }}
            >
              👥 Usuarios (CU-11)
            </button>
          )}

          <button
            onClick={() => setTabActiva("programacion")}
            style={{
              padding: "0.6rem 1rem",
              fontWeight: "600",
              fontSize: "0.9rem",
              color: tabActiva === "programacion" ? "#0284c7" : "#64748b",
              borderBottom: tabActiva === "programacion" ? "3px solid #0284c7" : "3px solid transparent",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            📅 Programación Semanal
          </button>

          <button
            onClick={() => setTabActiva("centros")}
            style={{
              padding: "0.6rem 1rem",
              fontWeight: "600",
              fontSize: "0.9rem",
              color: tabActiva === "centros" ? "#0284c7" : "#64748b",
              borderBottom: tabActiva === "centros" ? "3px solid #0284c7" : "3px solid transparent",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            🏢 Centros de Trabajo
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
            ⏱ Seguimiento y Jornada
          </button>

          <button
            onClick={() => setTabActiva("auditoria")}
            style={{
              padding: "0.6rem 1rem",
              fontWeight: "600",
              fontSize: "0.9rem",
              color: tabActiva === "auditoria" ? "#0284c7" : "#64748b",
              borderBottom: tabActiva === "auditoria" ? "3px solid #0284c7" : "3px solid transparent",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            📸 Auditoría de Evidencias
          </button>
        </nav>
      </div>

      {/* ALERTAS FEEDBACK */}
      {mensajeExito && (
        <div
          style={{
            backgroundColor: "#dcfce7",
            color: "#166534",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            marginBottom: "1rem",
            fontSize: "0.9rem",
            fontWeight: "500",
          }}
        >
          ✓ {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            marginBottom: "1rem",
            fontSize: "0.9rem",
            fontWeight: "500",
          }}
        >
          ✕ {mensajeError}
        </div>
      )}

      {cargando && (
        <div style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
          Cargando información...
        </div>
      )}

      {/* CONTENIDO SEGÚN PESTAÑA */}

      {/* 1. GESTIÓN DE USUARIOS (CU-11) */}
      {tabActiva === "usuarios" && esAdmin && !cargando && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
          {/* FORMULARIO CREAR USUARIO */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Crear Nuevo Usuario
            </h3>
            <form onSubmit={handleCrearUsuario} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carlos Mendoza"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", marginTop: "0.2rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Correo Institucional *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@plomada.local"
                  value={nuevoCorreo}
                  onChange={(e) => setNuevoCorreo(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", marginTop: "0.2rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Rol en el Sistema *
                </label>
                <select
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value as any)}
                  style={{ width: "100%", padding: "0.5rem", marginTop: "0.2rem" }}
                >
                  <option value="operario">Operario (Campo / PWA Offline)</option>
                  <option value="supervisor">Supervisor (Revisión de Evidencias)</option>
                  <option value="administrativo">Administrativo (Gestión y Programación)</option>
                  <option value="administrador">Administrador (Control Total)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Contraseña Inicial *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", marginTop: "0.2rem" }}
                />
              </div>

              <button
                type="submit"
                disabled={guardandoUsuario}
                className="btn-primario"
                style={{ marginTop: "0.5rem" }}
              >
                {guardandoUsuario ? "Guardando..." : "Crear Usuario"}
              </button>
            </form>
          </div>

          {/* LISTA DE USUARIOS */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Usuarios Registrados ({usuarios.length})
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                    <th style={{ padding: "0.5rem" }}>Nombre</th>
                    <th style={{ padding: "0.5rem" }}>Correo</th>
                    <th style={{ padding: "0.5rem" }}>Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.6rem 0.5rem", fontWeight: "500" }}>{u.nombre}</td>
                      <td style={{ padding: "0.6rem 0.5rem", color: "#64748b" }}>{u.correo}</td>
                      <td style={{ padding: "0.6rem 0.5rem" }}>
                        <span
                          className={`badge ${
                            u.rol === "administrador"
                              ? "badge-primario"
                              : u.rol === "supervisor"
                              ? "badge-alerta"
                              : u.rol === "operario"
                              ? "badge-exito"
                              : ""
                          }`}
                        >
                          {u.rol}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROGRAMACIÓN SEMANAL (CU-09, CU-10) */}
      {tabActiva === "programacion" && !cargando && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
          {/* LISTADO DE PROGRAMACIONES */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Semanas Programadas
            </h3>
            {programaciones.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No hay programaciones registradas.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {programaciones.map((prog) => (
                  <div
                    key={prog.id}
                    onClick={() => setProgramacionSeleccionada(prog)}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "6px",
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: programacionSeleccionada?.id === prog.id ? "#0284c7" : "#e2e8f0",
                      backgroundColor: programacionSeleccionada?.id === prog.id ? "#f0f9ff" : "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.9rem" }}>Semana: {prog.semanaInicio}</strong>
                      <span className={`badge ${prog.estado === "publicada" ? "badge-exito" : "badge-alerta"}`}>
                        {prog.estado}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>
                      {prog.asignaciones.length} asignaciones de cuadrilla
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DETALLE DE PROGRAMACIÓN SELECCIONADA */}
          <div className="tarjeta">
            {programacionSeleccionada ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                      Semana del {programacionSeleccionada.semanaInicio}
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Estado: <strong>{programacionSeleccionada.estado}</strong>
                    </span>
                  </div>

                  {programacionSeleccionada.estado === "borrador" && (
                    <button
                      onClick={() => handlePublicarProgramacion(programacionSeleccionada.id)}
                      disabled={publicandoId === programacionSeleccionada.id}
                      className="btn-primario"
                      style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                    >
                      {publicandoId === programacionSeleccionada.id
                        ? "Publicando..."
                        : "✉ Publicar y Notificar"}
                    </button>
                  )}
                </div>

                <h4 style={{ fontSize: "0.95rem", color: "#334155", margin: "1rem 0 0.5rem 0" }}>
                  Asignaciones ({programacionSeleccionada.asignaciones.length})
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {programacionSeleccionada.asignaciones.map((asig) => (
                    <div
                      key={asig.id}
                      style={{
                        padding: "0.75rem",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "0.85rem" }}>
                        <span>🏢 {asig.centroTrabajo.nombre}</span>
                        <span style={{ color: "#64748b" }}>📅 {asig.fecha}</span>
                      </div>
                      <div style={{ marginTop: "0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>
                          Actividades:
                        </span>
                        <ul style={{ margin: "0.2rem 0 0 1.2rem", padding: 0, fontSize: "0.8rem", color: "#334155" }}>
                          {asig.actividades.map((act) => (
                            <li key={act.id}>
                              {act.descripcion}{" "}
                              <span style={{ color: "#64748b", fontSize: "0.7rem" }}>({act.estado})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color: "#64748b" }}>Selecciona una semana para ver sus asignaciones.</p>
            )}
          </div>
        </div>
      )}

      {/* 3. CENTROS DE TRABAJO (CU-12) */}
      {tabActiva === "centros" && !cargando && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
          {/* FORMULARIO CREAR CENTRO */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Registrar Centro de Trabajo
            </h3>
            <form onSubmit={handleCrearCentro} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Nombre del Conjunto o Sede *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Conjunto Residencial Los Sauces"
                  value={nombreCentro}
                  onChange={(e) => setNombreCentro(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", marginTop: "0.2rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Dirección
                </label>
                <input
                  type="text"
                  placeholder="Ej: Carrera 15 # 120-40, Bogotá"
                  value={direccionCentro}
                  onChange={(e) => setDireccionCentro(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", marginTop: "0.2rem" }}
                />
              </div>

              <button
                type="submit"
                disabled={guardandoCentro}
                className="btn-primario"
                style={{ marginTop: "0.5rem" }}
              >
                {guardandoCentro ? "Guardando..." : "Guardar Centro"}
              </button>
            </form>
          </div>

          {/* LISTA DE CENTROS */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Centros Activos ({centros.length})
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
              {centros.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>🏢 {c.nombre}</strong>
                  <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    📍 {c.direccion || "Sin dirección registrada"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. SEGUIMIENTO Y JORNADA (CU-08, CU-14) */}
      {tabActiva === "seguimiento" && !cargando && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* FILTRO DE FECHA */}
          <div className="tarjeta" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <label style={{ fontWeight: "600", fontSize: "0.9rem", color: "#334155" }}>
              Fecha a consultar:
            </label>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              style={{ padding: "0.4rem 0.6rem" }}
            />
            <button
              onClick={() => void cargarDatosTab("seguimiento")}
              className="btn-primario"
              style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
            >
              Consultar
            </button>
          </div>

          {/* TARJETAS RESUMEN SEGUIMIENTO */}
          {seguimiento && (() => {
            const totalActividades = seguimiento.operarios.reduce((acc, o) => acc + o.actividades.length, 0);
            const finalizadas = seguimiento.operarios.reduce(
              (acc, o) => acc + o.actividades.filter((a) => a.estado === "finalizada" || a.estado === "aprobada").length,
              0,
            );
            const porcentaje = totalActividades > 0 ? Math.round((finalizadas / totalActividades) * 100) : 0;
            const activos = seguimiento.operarios.filter((o) => o.entradaEn !== null).length;

            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div className="tarjeta" style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Avance de la Jornada</span>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#0284c7" }}>
                    {porcentaje}%
                  </div>
                </div>
                <div className="tarjeta" style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Operarios Activos Hoy</span>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#0f172a" }}>
                    {activos} / {seguimiento.operarios.length}
                  </div>
                </div>
                <div className="tarjeta" style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Actividades Finalizadas</span>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#16a34a" }}>
                    {finalizadas} / {totalActividades}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* AUDITORÍA DE REGISTROS DE JORNADA */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Control de Horario y Marcas de Asistencia ({registrosJornada.length})
            </h3>
            {registrosJornada.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                No hay registros de jornada reportados para la fecha seleccionada.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "0.5rem" }}>Tipo de Registro</th>
                      <th style={{ padding: "0.5rem" }}>Hora Celular (Capturada)</th>
                      <th style={{ padding: "0.5rem" }}>Hora Servidor (Recibida)</th>
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
                          <td style={{ padding: "0.5rem" }}>
                            {new Date(reg.capturadoEn).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: "0.5rem", color: "#64748b" }}>
                            {new Date(reg.recibidoEn).toLocaleTimeString()}
                          </td>
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
          </div>
        </div>
      )}

      {/* 5. AUDITORÍA DE ACTIVIDADES Y EVIDENCIAS (MODO LECTURA) */}
      {tabActiva === "auditoria" && !cargando && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* LISTA DE ACTIVIDADES */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Actividades del Sistema
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {actividades.map((act) => (
                <div
                  key={act.id}
                  onClick={() => handleSeleccionarActividad(act.id)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: actividadSeleccionada?.id === act.id ? "#0284c7" : "#e2e8f0",
                    backgroundColor: actividadSeleccionada?.id === act.id ? "#f0f9ff" : "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{act.descripcion}</strong>
                    <span className="badge badge-primario">{act.estado}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>
                    🏢 {act.centroTrabajo.nombre} | 👤 {act.operario.nombre}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DETALLE Y FOTOS DE LA ACTIVIDAD (SIN FORMULARIO DE SUPERVISOR) */}
          <div className="tarjeta">
            {actividadSeleccionada ? (
              <div>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>
                  {actividadSeleccionada.descripcion}
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                  Estado actual: <strong>{actividadSeleccionada.estado}</strong>
                </p>

                <h4 style={{ fontSize: "0.95rem", color: "#334155", margin: "1rem 0 0.5rem 0" }}>
                  Evidencias Fotográficas ({actividadSeleccionada.evidencias.length})
                </h4>

                {actividadSeleccionada.evidencias.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                    Aún no se han recibido evidencias para esta actividad.
                  </p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
                    {actividadSeleccionada.evidencias.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#f1f5f9",
                            padding: "0.2rem 0.4rem",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            textTransform: "capitalize",
                          }}
                        >
                          {ev.tipo}
                        </div>
                        <FotoProtegida
                          evidenciaId={ev.id}
                          alt={`Evidencia ${ev.tipo}`}
                          style={{ width: "100%", height: "120px", objectFit: "cover" }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "#64748b" }}>
                Selecciona una actividad para auditar sus fotos de evidencia.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
