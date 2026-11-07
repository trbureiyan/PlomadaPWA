import React, { useEffect, useState } from "react";
import type {
  ActividadDetalle,
  ActividadResumen,
  CentroTrabajo,
  HojaDeVida,
  ProgramacionSemanal,
  RegistroJornada,
  Rol,
  SeguimientoDia,
  Usuario,
} from "@plomada/shared";
import { clienteApi } from "../infrastructure/api/cliente-api";
import { FotoProtegida } from "./FotoProtegida";

interface Props {
  usuario: Usuario;
}

type TabAdmin = "usuarios" | "programacion" | "centros" | "hojas-vida" | "seguimiento" | "auditoria";

export interface ErroresFormularioUsuario {
  nombre?: string;
  correo?: string;
  contrasena?: string;
}

/**
 * Valida el formulario de creación de usuarios (C-9 / nota 015).
 * Valida únicamente el formato estándar de correo electrónico para todos los roles,
 * sin restringir a dominios específicos.
 */
export function validarFormularioUsuario(
  datos: {
    nombre: string;
    correo: string;
    rol: Rol;
    contrasena: string;
  },
  usuariosExistentes: Array<{ correo: string }> = [],
): ErroresFormularioUsuario {
  const errs: ErroresFormularioUsuario = {};

  const nombreLimpio = datos.nombre.trim();
  if (!nombreLimpio) {
    errs.nombre = "El nombre completo no puede estar vacío";
  } else if (nombreLimpio.length < 3) {
    errs.nombre = "El nombre debe tener al menos 3 caracteres";
  }

  const correoLimpio = datos.correo.trim().toLowerCase();
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!correoLimpio) {
    errs.correo = "El correo electrónico es obligatorio";
  } else if (!regexEmail.test(correoLimpio)) {
    errs.correo = "Ingresa un correo válido (ej: usuario@empresa.com)";
  } else if (usuariosExistentes.some((u) => u.correo.toLowerCase() === correoLimpio)) {
    errs.correo = "Este correo electrónico ya se encuentra registrado en el sistema";
  }

  if (!datos.contrasena) {
    errs.contrasena = "La contraseña es obligatoria";
  } else if (datos.contrasena.trim().length < 8) {
    errs.contrasena = "La contraseña debe tener mínimo 8 caracteres (sin solo espacios)";
  }

  return errs;
}

export const AdminDashboard: React.FC<Props> = ({ usuario }) => {
  const esAdmin = usuario.rol === "administrador";
  const [tabActiva, setTabActiva] = useState<TabAdmin>(esAdmin ? "usuarios" : "programacion");

  // Estado Usuarios
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [nuevoRol, setNuevoRol] = useState<"operario" | "supervisor" | "administrativo" | "administrador">("operario");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [erroresUsuario, setErroresUsuario] = useState<{
    nombre?: string;
    correo?: string;
    contrasena?: string;
  }>({});
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  // Estado Centros
  const [centros, setCentros] = useState<CentroTrabajo[]>([]);
  const [nombreCentro, setNombreCentro] = useState("");
  const [direccionCentro, setDireccionCentro] = useState("");
  const [guardandoCentro, setGuardandoCentro] = useState(false);

  // Estado Hojas de Vida (CU-13)
  const [operariosHV, setOperariosHV] = useState<Usuario[]>([]);
  const [operarioHVSeleccionado, setOperarioHVSeleccionado] = useState<string>("");
  const [hojaDeVidaActual, setHojaDeVidaActual] = useState<HojaDeVida | null>(null);
  const [tipoDocHV, setTipoDocHV] = useState<"CC" | "CE" | "otro">("CC");
  const [numDocHV, setNumDocHV] = useState("");
  const [telefonoHV, setTelefonoHV] = useState("");
  const [cargoHV, setCargoHV] = useState("Operario de Mantenimiento Locativo");
  const [fechaIngresoHV, setFechaIngresoHV] = useState(() => new Date().toISOString().slice(0, 10));
  const [cursoAlturasHV, setCursoAlturasHV] = useState(false);
  const [vencimientoAlturasHV, setVencimientoAlturasHV] = useState("");
  const [formacionHV, setFormacionHV] = useState("Bachiller Académico\nTécnico en Mantenimiento de Piscinas (SENA)");
  const [experienciaHV, setExperienciaHV] = useState("2 años en mantenimiento de conjuntos residenciales");
  const [guardandoHV, setGuardandoHV] = useState(false);
  const [cargandoHV, setCargandoHV] = useState(false);
  const [erroresHV, setErroresHV] = useState<{ doc?: string; cargo?: string; fecha?: string }>({});

  // Estado Programación (CU-09, CU-10)
  const [programaciones, setProgramaciones] = useState<ProgramacionSemanal[]>([]);
  const [programacionSeleccionada, setProgramacionSeleccionada] = useState<ProgramacionSemanal | null>(null);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [semanaLunes, setSemanaLunes] = useState(() => {
    const ahora = new Date();
    const dia = ahora.getUTCDay();
    const diff = dia === 0 ? -6 : 1 - dia;
    const lunes = new Date(ahora);
    lunes.setUTCDate(ahora.getUTCDate() + diff + 7);
    return lunes.toISOString().slice(0, 10);
  });
  const [centroSeleccionadoId, setCentroSeleccionadoId] = useState("");
  const [operarioSeleccionadoId, setOperarioSeleccionadoId] = useState("");
  const [fechaAsignacion, setFechaAsignacion] = useState("");
  const [nuevaDescripcionActividad, setNuevaDescripcionActividad] = useState("");
  const [actividadesCreando, setActividadesCreando] = useState<string[]>([]);
  const [asignacionesBorrador, setAsignacionesBorrador] = useState<
    Array<{
      operarioId: string;
      centroTrabajoId: string;
      fecha: string;
      actividades: Array<{ descripcion: string }>;
    }>
  >([]);
  const [erroresProg, setErroresProg] = useState<{
    semana?: string;
    centro?: string;
    operario?: string;
    fecha?: string;
    actividades?: string;
  }>({});
  const [guardandoProg, setGuardandoProg] = useState(false);

  const viernesSemana = (() => {
    if (!semanaLunes) return "";
    const f = new Date(semanaLunes + "T00:00:00Z");
    f.setUTCDate(f.getUTCDate() + 4);
    return f.toISOString().slice(0, 10);
  })();

  const semanaYaExiste = programaciones.some((p) => p.semanaInicio === semanaLunes);

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
      } else if (tab === "hojas-vida") {
        const u = await clienteApi.listarUsuarios({ rol: "operario" });
        setOperariosHV(u);
        const inicial = operarioHVSeleccionado || (u.length > 0 ? u[0].id : "");
        if (inicial) {
          setOperarioHVSeleccionado(inicial);
          void cargarHojaDeVida(inicial);
        }
      } else if (tab === "programacion") {
        const [p, c, u] = await Promise.all([
          clienteApi.listarProgramaciones(),
          centros.length > 0 ? Promise.resolve(centros) : clienteApi.listarCentrosTrabajo().catch(() => []),
          operariosHV.length > 0 ? Promise.resolve(operariosHV) : clienteApi.listarUsuarios({ rol: "operario" }).catch(() => []),
        ]);
        setProgramaciones(p);
        if (centros.length === 0) setCentros(c);
        if (operariosHV.length === 0) setOperariosHV(u);
        if (p.length > 0 && !programacionSeleccionada) {
          setProgramacionSeleccionada(p[0]);
        }
        if (c.length > 0 && !centroSeleccionadoId) {
          setCentroSeleccionadoId(c[0].id);
        }
        if (u.length > 0 && !operarioSeleccionadoId) {
          setOperarioSeleccionadoId(u[0].id);
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

  const cargarHojaDeVida = async (opId: string) => {
    setCargandoHV(true);
    try {
      const hv = await clienteApi.obtenerHojaDeVida(opId);
      setHojaDeVidaActual(hv);
      if (hv) {
        setTipoDocHV(hv.tipoDocumento);
        setNumDocHV(hv.numeroDocumento);
        setTelefonoHV(hv.telefono || "");
        setCargoHV(hv.cargo);
        setFechaIngresoHV(hv.fechaIngreso);
        setCursoAlturasHV(Boolean(hv.cursoAlturas));
        setVencimientoAlturasHV(hv.vencimientoAlturas || "");
        setFormacionHV(hv.formacion.join("\n"));
        setExperienciaHV(hv.experiencia.join("\n"));
      } else {
        setNumDocHV("");
        setTelefonoHV("");
        setCargoHV("Operario de Mantenimiento Locativo");
        setFechaIngresoHV(new Date().toISOString().slice(0, 10));
        setCursoAlturasHV(false);
        setVencimientoAlturasHV("");
        setFormacionHV("Bachiller Académico\nTécnico en Mantenimiento de Piscinas (SENA)");
        setExperienciaHV("2 años en mantenimiento de conjuntos residenciales");
      }
    } catch {
      setHojaDeVidaActual(null);
    } finally {
      setCargandoHV(false);
    }
  };

  const handleGuardarHojaDeVida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operarioHVSeleccionado) {
      mostrarError("Selecciona un operario");
      return;
    }

    const errs: { doc?: string; cargo?: string; fecha?: string } = {};
    if (!numDocHV.trim()) errs.doc = "El número de documento es obligatorio";
    if (!cargoHV.trim()) errs.cargo = "El cargo es obligatorio";
    if (!fechaIngresoHV.trim()) errs.fecha = "La fecha de ingreso es obligatoria";

    if (Object.keys(errs).length > 0) {
      setErroresHV(errs);
      return;
    }
    setErroresHV({});
    setGuardandoHV(true);

    const opEncontrado = operariosHV.find((o) => o.id === operarioHVSeleccionado);
    const nombreCompleto = opEncontrado?.nombre || "Operario";

    try {
      const guardada = await clienteApi.guardarHojaDeVida(operarioHVSeleccionado, {
        nombreCompleto,
        tipoDocumento: tipoDocHV,
        numeroDocumento: numDocHV.trim(),
        telefono: telefonoHV.trim() || undefined,
        cargo: cargoHV.trim(),
        fechaIngreso: fechaIngresoHV,
        cursoAlturas: cursoAlturasHV,
        vencimientoAlturas: vencimientoAlturasHV.trim() || undefined,
        formacion: formacionHV.split("\n").map((s) => s.trim()).filter(Boolean),
        experiencia: experienciaHV.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      setHojaDeVidaActual(guardada);
      mostrarExito(`Hoja de vida de ${nombreCompleto} guardada y actualizada exitosamente`);
    } catch (err) {
      mostrarError((err as Error).message || "Error al guardar hoja de vida");
    } finally {
      setGuardandoHV(false);
    }
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validarFormularioUsuario(
      {
        nombre: nuevoNombre,
        correo: nuevoCorreo,
        rol: nuevoRol,
        contrasena: nuevaPassword,
      },
      usuarios,
    );

    if (Object.keys(errs).length > 0) {
      setErroresUsuario(errs);
      return;
    }

    setErroresUsuario({});
    setGuardandoUsuario(true);
    const nombreLimpio = nuevoNombre.trim();
    const correoLimpio = nuevoCorreo.trim().toLowerCase();
    try {
      const creado = await clienteApi.crearUsuario({
        nombre: nombreLimpio,
        correo: correoLimpio,
        rol: nuevoRol,
        contrasenaInicial: nuevaPassword.trim(),
      });
      setUsuarios((prev) => [creado, ...prev]);
      setNuevoNombre("");
      setNuevoCorreo("");
      setNuevaPassword("");
      mostrarExito(`Usuario ${creado.nombre} (${creado.rol}) creado exitosamente`);
    } catch (err) {
      const msg = (err as Error).message || "Error al crear usuario";
      if (msg.includes("409") || msg.includes("conflicto")) {
        mostrarError(`Ya existe un usuario registrado con el correo "${correoLimpio}". Por favor verifica el correo o utiliza uno diferente.`);
        setErroresUsuario((p) => ({ ...p, correo: "Este correo electrónico ya se encuentra registrado" }));
      } else {
        mostrarError(msg);
      }
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

  const handleAgregarActividadProg = () => {
    const desc = nuevaDescripcionActividad.trim();
    if (!desc) {
      setErroresProg((prev) => ({ ...prev, actividades: "Escribe una descripción para la actividad" }));
      return;
    }
    setActividadesCreando((prev) => [...prev, desc]);
    setNuevaDescripcionActividad("");
    setErroresProg((prev) => ({ ...prev, actividades: undefined }));
  };

  const handleAgregarAsignacionBorrador = () => {
    const errs: { semana?: string; centro?: string; operario?: string; fecha?: string; actividades?: string } = {};

    if (!semanaLunes) errs.semana = "Selecciona el lunes de inicio";
    if (!centroSeleccionadoId) errs.centro = "Selecciona un centro de trabajo";
    if (!operarioSeleccionadoId) errs.operario = "Selecciona un operario";
    if (!fechaAsignacion) {
      errs.fecha = "Selecciona la fecha de la jornada";
    } else {
      const fechaObj = new Date(fechaAsignacion + "T00:00:00Z");
      const diaSemana = fechaObj.getUTCDay();
      if (diaSemana === 0 || diaSemana === 6) {
        errs.fecha = "La fecha debe estar entre lunes y viernes (días hábiles)";
      } else if (fechaAsignacion < semanaLunes || fechaAsignacion > viernesSemana) {
        errs.fecha = `La fecha (${fechaAsignacion}) debe estar entre el lunes ${semanaLunes} y el viernes ${viernesSemana}`;
      }
    }

    const listaActividades = [...actividadesCreando];
    if (nuevaDescripcionActividad.trim()) {
      listaActividades.push(nuevaDescripcionActividad.trim());
    }

    if (listaActividades.length === 0) {
      errs.actividades = "Debes ingresar al menos una actividad locativa a realizar";
    }

    if (Object.keys(errs).length > 0) {
      setErroresProg(errs);
      return;
    }

    setErroresProg({});
    setAsignacionesBorrador((prev) => [
      ...prev,
      {
        operarioId: operarioSeleccionadoId,
        centroTrabajoId: centroSeleccionadoId,
        fecha: fechaAsignacion,
        actividades: listaActividades.map((d) => ({ descripcion: d })),
      },
    ]);
    setActividadesCreando([]);
    setNuevaDescripcionActividad("");
    mostrarExito("Asignación agregada al borrador semanal");
  };

  const handleCrearProgramacion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!semanaLunes) {
      mostrarError("Selecciona la fecha de inicio de la semana.");
      setErroresProg((p) => ({ ...p, semana: "Selecciona el lunes de inicio" }));
      return;
    }

    const objLunes = new Date(semanaLunes + "T00:00:00Z");
    if (objLunes.getUTCDay() !== 1) {
      mostrarError(`La fecha ${semanaLunes} no corresponde a un día lunes. La programación semanal debe iniciar obligatoriamente en día Lunes.`);
      setErroresProg((p) => ({ ...p, semana: "La fecha debe ser un día Lunes" }));
      return;
    }

    if (semanaYaExiste) {
      mostrarError("Ya existe una programación registrada para esta semana. Selecciona una semana diferente.");
      return;
    }

    const todasAsignaciones = [...asignacionesBorrador];

    const listaActividadesActual = [...actividadesCreando];
    if (nuevaDescripcionActividad.trim()) {
      listaActividadesActual.push(nuevaDescripcionActividad.trim());
    }

    if (fechaAsignacion && centroSeleccionadoId && operarioSeleccionadoId && listaActividadesActual.length > 0) {
      const fechaObj = new Date(fechaAsignacion + "T00:00:00Z");
      const diaSemana = fechaObj.getUTCDay();
      if (diaSemana === 0 || diaSemana === 6) {
        mostrarError("La fecha de asignación debe ser entre lunes y viernes (días hábiles)");
        return;
      }
      if (fechaAsignacion < semanaLunes || fechaAsignacion > viernesSemana) {
        mostrarError(`La fecha de asignación (${fechaAsignacion}) debe estar entre el lunes ${semanaLunes} y el viernes ${viernesSemana}`);
        return;
      }
      todasAsignaciones.push({
        operarioId: operarioSeleccionadoId,
        centroTrabajoId: centroSeleccionadoId,
        fecha: fechaAsignacion,
        actividades: listaActividadesActual.map((desc) => ({ descripcion: desc })),
      });
    }

    if (todasAsignaciones.length === 0) {
      mostrarError("Debes agregar al menos una asignación con actividades a la programación semanal");
      return;
    }

    // Validar que todas las asignaciones acumuladas pertenezcan al rango de la semana seleccionada
    for (const asig of todasAsignaciones) {
      if (asig.fecha < semanaLunes || asig.fecha > viernesSemana) {
        mostrarError(`Una asignación con fecha ${asig.fecha} está fuera del rango de la semana (${semanaLunes} al ${viernesSemana}). Por favor corrígela.`);
        return;
      }
      if (!asig.operarioId || !asig.centroTrabajoId) {
        mostrarError("Cada asignación debe tener un operario y un centro de trabajo válidos.");
        return;
      }
      if (!asig.actividades || asig.actividades.length === 0) {
        mostrarError(`La asignación del ${asig.fecha} debe contener al menos una actividad locativa.`);
        return;
      }
    }

    setGuardandoProg(true);
    try {
      const nuevaProg = await clienteApi.crearProgramacion({
        semanaInicio: semanaLunes,
        asignaciones: todasAsignaciones,
      });

      setProgramaciones((prev) => [nuevaProg, ...prev]);
      setProgramacionSeleccionada(nuevaProg);
      setAsignacionesBorrador([]);
      setActividadesCreando([]);
      setNuevaDescripcionActividad("");
      setFechaAsignacion("");
      mostrarExito(`Programación semanal para el ${nuevaProg.semanaInicio} creada en borrador con éxito (${nuevaProg.asignaciones.length} asignaciones)`);
    } catch (err) {
      const msg = (err as Error).message || "Error al crear programación";
      if (msg.includes("409") || msg.includes("conflicto")) {
        mostrarError("Ya existe una programación registrada para esta semana. Selecciona una semana diferente.");
      } else {
        mostrarError(msg);
      }
    } finally {
      setGuardandoProg(false);
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
            onClick={() => setTabActiva("hojas-vida")}
            style={{
              padding: "0.6rem 1rem",
              fontWeight: "600",
              fontSize: "0.9rem",
              color: tabActiva === "hojas-vida" ? "#0284c7" : "#64748b",
              borderBottom: tabActiva === "hojas-vida" ? "3px solid #0284c7" : "3px solid transparent",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            📋 Hojas de Vida (CU-13)
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
                  placeholder="Ej: Carlos Mendoza"
                  value={nuevoNombre}
                  onChange={(e) => {
                    setNuevoNombre(e.target.value);
                    setErroresUsuario((p) => ({ ...p, nombre: undefined }));
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginTop: "0.2rem",
                    border: erroresUsuario.nombre ? "1px solid #ef4444" : "1px solid #cbd5e1",
                  }}
                />
                {erroresUsuario.nombre && (
                  <span style={{ color: "#ef4444", fontSize: "0.75rem", display: "block", marginTop: "0.2rem" }}>
                    {erroresUsuario.nombre}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Correo Institucional *
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@empresa.com"
                  value={nuevoCorreo}
                  onChange={(e) => {
                    setNuevoCorreo(e.target.value);
                    setErroresUsuario((p) => ({ ...p, correo: undefined }));
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginTop: "0.2rem",
                    border: erroresUsuario.correo ? "1px solid #ef4444" : "1px solid #cbd5e1",
                  }}
                />
                {erroresUsuario.correo && (
                  <span style={{ color: "#ef4444", fontSize: "0.75rem", display: "block", marginTop: "0.2rem" }}>
                    {erroresUsuario.correo}
                  </span>
                )}
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
                  placeholder="Mínimo 8 caracteres"
                  value={nuevaPassword}
                  onChange={(e) => {
                    setNuevaPassword(e.target.value);
                    setErroresUsuario((p) => ({ ...p, contrasena: undefined }));
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginTop: "0.2rem",
                    border: erroresUsuario.contrasena ? "1px solid #ef4444" : "1px solid #cbd5e1",
                  }}
                />
                {erroresUsuario.contrasena && (
                  <span style={{ color: "#ef4444", fontSize: "0.75rem", display: "block", marginTop: "0.2rem" }}>
                    {erroresUsuario.contrasena}
                  </span>
                )}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* FORMULARIO CREAR PROGRAMACIÓN SEMANAL (CU-09) */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Nueva Asignación / Programación Semanal
            </h3>

            <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1", padding: "0.6rem 0.8rem", borderRadius: "6px", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
              ℹ <strong>Nota:</strong> Los operarios solo pueden consultar y registrar actividades cuando la programación se encuentre en estado <strong>publicada</strong> mediante el botón "✉ Publicar y Notificar".
            </div>

            <form onSubmit={handleCrearProgramacion} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Semana de Inicio (Lunes) *
                </label>
                <input
                  type="date"
                  value={semanaLunes}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSemanaLunes(val);
                    if (val) {
                      const d = new Date(val + "T00:00:00Z");
                      if (d.getUTCDay() !== 1) {
                        setErroresProg((p) => ({ ...p, semana: "La fecha seleccionada no es un día lunes" }));
                      } else {
                        setErroresProg((p) => ({ ...p, semana: undefined }));
                      }
                    }
                  }}
                  style={{ width: "100%", padding: "0.45rem", marginTop: "0.2rem" }}
                />
                {erroresProg.semana && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{erroresProg.semana}</span>}
              </div>

              {semanaYaExiste && (
                <div style={{ backgroundColor: "#fef3c7", color: "#92400e", padding: "0.6rem 0.8rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "600" }}>
                  ⚠️ Ya existe una programación registrada para esta semana. Selecciona una semana diferente (ej. la próxima semana).
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Centro de Trabajo / Conjunto *
                </label>
                <select
                  value={centroSeleccionadoId}
                  onChange={(e) => {
                    setCentroSeleccionadoId(e.target.value);
                    setErroresProg((p) => ({ ...p, centro: undefined }));
                  }}
                  style={{ width: "100%", padding: "0.45rem", marginTop: "0.2rem" }}
                >
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                {erroresProg.centro && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{erroresProg.centro}</span>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Operario Asignado *
                </label>
                <select
                  value={operarioSeleccionadoId}
                  onChange={(e) => {
                    setOperarioSeleccionadoId(e.target.value);
                    setErroresProg((p) => ({ ...p, operario: undefined }));
                  }}
                  style={{ width: "100%", padding: "0.45rem", marginTop: "0.2rem" }}
                >
                  {operariosHV.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre} ({o.correo})
                    </option>
                  ))}
                </select>
                {erroresProg.operario && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{erroresProg.operario}</span>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Fecha de la Jornada (Lunes a Viernes) *
                </label>
                <input
                  type="date"
                  value={fechaAsignacion}
                  onChange={(e) => {
                    setFechaAsignacion(e.target.value);
                    setErroresProg((p) => ({ ...p, fecha: undefined }));
                  }}
                  style={{ width: "100%", padding: "0.45rem", marginTop: "0.2rem" }}
                />
                {erroresProg.fecha && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{erroresProg.fecha}</span>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                  Actividades Locativas *
                </label>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem" }}>
                  <input
                    type="text"
                    placeholder="Ej: Pintura de muro perimetral"
                    value={nuevaDescripcionActividad}
                    onChange={(e) => setNuevaDescripcionActividad(e.target.value)}
                    style={{ flex: 1, padding: "0.45rem" }}
                  />
                  <button
                    type="button"
                    onClick={handleAgregarActividadProg}
                    style={{
                      padding: "0.45rem 0.8rem",
                      background: "#334155",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    + Agregar
                  </button>
                </div>
                {erroresProg.actividades && (
                  <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{erroresProg.actividades}</span>
                )}

                {actividadesCreando.length > 0 && (
                  <ul style={{ margin: "0.5rem 0 0 1rem", padding: 0, fontSize: "0.8rem", color: "#334155" }}>
                    {actividadesCreando.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={handleAgregarAsignacionBorrador}
                  style={{
                    padding: "0.45rem 0.75rem",
                    background: "#e2e8f0",
                    color: "#334155",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                  }}
                >
                  + Agregar Asignación a la Semana
                </button>
              </div>

              {asignacionesBorrador.length > 0 && (
                <div style={{ backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.75rem" }}>
                  <strong style={{ fontSize: "0.85rem", color: "#334155" }}>
                    Asignaciones preparadas para esta semana ({asignacionesBorrador.length}):
                  </strong>
                  <ul style={{ margin: "0.4rem 0 0 1rem", padding: 0, fontSize: "0.8rem", color: "#475569" }}>
                    {asignacionesBorrador.map((asig, idx) => {
                      const opNom = operariosHV.find((o) => o.id === asig.operarioId)?.nombre || asig.operarioId;
                      const cNom = centros.find((c) => c.id === asig.centroTrabajoId)?.nombre || asig.centroTrabajoId;
                      return (
                        <li key={idx} style={{ marginBottom: "0.25rem" }}>
                          <strong>{asig.fecha}:</strong> {opNom} en {cNom} ({asig.actividades.length} actividades)
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <button
                type="submit"
                disabled={guardandoProg || semanaYaExiste}
                className="btn-primario"
                style={{ marginTop: "0.5rem" }}
              >
                {guardandoProg ? "Guardando..." : "Guardar Programación Completa (Borrador)"}
              </button>
            </form>
          </div>

          {/* LISTADO Y DETALLE DE PROGRAMACIONES */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="tarjeta">
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
                Semanas Registradas ({programaciones.length})
              </h3>
              {programaciones.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No hay programaciones registradas.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto" }}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className={`badge ${prog.estado === "publicada" ? "badge-exito" : "badge-alerta"}`}>
                            {prog.estado}
                          </span>
                          {prog.estado === "borrador" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handlePublicarProgramacion(prog.id);
                              }}
                              disabled={publicandoId === prog.id}
                              className="btn-primario"
                              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                            >
                              {publicandoId === prog.id ? "..." : "✉ Publicar"}
                            </button>
                          )}
                        </div>
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
                      <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
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

                  <h4 style={{ fontSize: "0.9rem", color: "#334155", margin: "0.5rem 0" }}>
                    Asignaciones ({programacionSeleccionada.asignaciones.length})
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto" }}>
                    {programacionSeleccionada.asignaciones.map((asig) => (
                      <div
                        key={asig.id}
                        style={{
                          padding: "0.6rem",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "0.8rem" }}>
                          <span>🏢 {asig.centroTrabajo.nombre}</span>
                          <span style={{ color: "#64748b" }}>📅 {asig.fecha}</span>
                        </div>
                        <div style={{ marginTop: "0.3rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>
                            Actividades:
                          </span>
                          <ul style={{ margin: "0.2rem 0 0 1.2rem", padding: 0, fontSize: "0.75rem", color: "#334155" }}>
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
                <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Selecciona una semana para ver sus asignaciones.</p>
              )}
            </div>
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

      {/* 4. GESTIÓN DE HOJAS DE VIDA (CU-13) */}
      {tabActiva === "hojas-vida" && !cargando && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
          {/* SELECCIONAR OPERARIO */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Seleccionar Operario
            </h3>
            {operariosHV.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No hay operarios registrados en el sistema.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {operariosHV.map((op) => (
                  <div
                    key={op.id}
                    onClick={() => {
                      setOperarioHVSeleccionado(op.id);
                      void cargarHojaDeVida(op.id);
                    }}
                    style={{
                      padding: "0.6rem 0.8rem",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: operarioHVSeleccionado === op.id ? "#0284c7" : "#e2e8f0",
                      backgroundColor: operarioHVSeleccionado === op.id ? "#f0f9ff" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                    }}
                  >
                    <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>👷 {op.nombre}</strong>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{op.correo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FORMULARIO EXPEDIENTE LABORAL */}
          <div className="tarjeta">
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
              Expediente Laboral y Hoja de Vida (CU-13)
            </h3>
            {cargandoHV ? (
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Cargando expediente...</p>
            ) : !operarioHVSeleccionado ? (
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Selecciona un operario del panel izquierdo.</p>
            ) : (
              <form onSubmit={handleGuardarHojaDeVida} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.5rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                      Tipo Documento *
                    </label>
                    <select
                      value={tipoDocHV}
                      onChange={(e) => setTipoDocHV(e.target.value as any)}
                      style={{ width: "100%", padding: "0.45rem", marginTop: "0.2rem" }}
                    >
                      <option value="CC">Cédula de Ciudadanía (CC)</option>
                      <option value="CE">Cédula de Extranjería (CE)</option>
                      <option value="otro">Otro Documento</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                      Número de Documento *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 1075283941"
                      value={numDocHV}
                      onChange={(e) => {
                        setNumDocHV(e.target.value);
                        setErroresHV((p) => ({ ...p, doc: undefined }));
                      }}
                      style={{
                        width: "100%",
                        padding: "0.45rem",
                        marginTop: "0.2rem",
                        border: erroresHV.doc ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      }}
                    />
                    {erroresHV.doc && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{erroresHV.doc}</span>}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                      Teléfono de Contacto
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej: 3105551234"
                      value={telefonoHV}
                      onChange={(e) => setTelefonoHV(e.target.value)}
                      style={{ width: "100%", padding: "0.45rem", marginTop: "0.2rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                      Cargo Laboral *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Operario de Mantenimiento"
                      value={cargoHV}
                      onChange={(e) => {
                        setCargoHV(e.target.value);
                        setErroresHV((p) => ({ ...p, cargo: undefined }));
                      }}
                      style={{
                        width: "100%",
                        padding: "0.45rem",
                        marginTop: "0.2rem",
                        border: erroresHV.cargo ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      }}
                    />
                    {erroresHV.cargo && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{erroresHV.cargo}</span>}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                    Fecha de Ingreso a la Empresa *
                  </label>
                  <input
                    type="date"
                    value={fechaIngresoHV}
                    onChange={(e) => {
                      setFechaIngresoHV(e.target.value);
                      setErroresHV((p) => ({ ...p, fecha: undefined }));
                    }}
                    style={{
                      width: "100%",
                      padding: "0.45rem",
                      marginTop: "0.2rem",
                      border: erroresHV.fecha ? "1px solid #ef4444" : "1px solid #cbd5e1",
                    }}
                  />
                  {erroresHV.fecha && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{erroresHV.fecha}</span>}
                </div>

                {/* SEGURIDAD INDUSTRIAL: CURSO DE ALTURAS */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: "600", color: "#1e293b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={cursoAlturasHV}
                      onChange={(e) => setCursoAlturasHV(e.target.checked)}
                    />
                    Certificación de Trabajo en Alturas (Vigente)
                  </label>
                  {cursoAlturasHV && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>
                        Fecha de Vencimiento de Certificación
                      </label>
                      <input
                        type="date"
                        value={vencimientoAlturasHV}
                        onChange={(e) => setVencimientoAlturasHV(e.target.value)}
                        style={{ width: "100%", padding: "0.4rem", marginTop: "0.2rem" }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                    Formación Académica / Cursos (una por línea)
                  </label>
                  <textarea
                    rows={2}
                    value={formacionHV}
                    onChange={(e) => setFormacionHV(e.target.value)}
                    style={{ width: "100%", padding: "0.45rem", marginTop: "0.2rem", fontSize: "0.8rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>
                    Experiencia Laboral Previa (una por línea)
                  </label>
                  <textarea
                    rows={2}
                    value={experienciaHV}
                    onChange={(e) => setExperienciaHV(e.target.value)}
                    style={{ width: "100%", padding: "0.45rem", marginTop: "0.2rem", fontSize: "0.8rem" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={guardandoHV}
                  className="btn-primario"
                  style={{ marginTop: "0.5rem" }}
                >
                  {guardandoHV ? "Guardando..." : "Guardar Hoja de Vida"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 5. SEGUIMIENTO Y JORNADA (CU-08, CU-14) */}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

                {/* TABLA DETALLADA DE SEGUIMIENTO POR OPERARIO Y ACTIVIDAD (CU-08) */}
                <div className="tarjeta">
                  <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "#1e293b" }}>
                    Seguimiento Detallado por Operario y Actividad
                  </h3>
                  {seguimiento.operarios.length === 0 ? (
                    <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                      No hay operarios asignados en la fecha seleccionada.
                    </p>
                  ) : (
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
                                  <span style={{ color: "#94a3b8" }}>Sin actividades asignadas</span>
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
                                <div>In: {op.entradaEn ? new Date(op.entradaEn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No registrada"}</div>
                                <div>Out: {op.salidaEn ? new Date(op.salidaEn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No registrada"}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
