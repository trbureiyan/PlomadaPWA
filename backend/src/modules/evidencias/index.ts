// Dominio
export * from "./domain/evidencia";
export * from "./domain/revision";
export * from "./domain/errores";

// Puertos
export * from "./application/ports/evidencia-repository.port";
export * from "./application/ports/revision-repository.port";
export * from "./application/ports/almacenamiento-evidencias.port";
export * from "./application/ports/consulta-actividad.port";

// Casos de uso
export * from "./application/subir-evidencia.use-case";
export * from "./application/obtener-foto-evidencia.use-case";
export * from "./application/listar-actividades.use-case";
export * from "./application/obtener-actividad-detalle.use-case";
export * from "./application/revisar-actividad.use-case";

// Infraestructura
export * from "./infrastructure/storage/in-memory-almacenamiento-evidencias";
export * from "./infrastructure/storage/disco-almacenamiento-evidencias";
export * from "./infrastructure/persistence/in-memory-evidencia.repository";
export * from "./infrastructure/persistence/in-memory-revision.repository";
export * from "./infrastructure/persistence/pg-evidencia.repository";
export * from "./infrastructure/persistence/pg-revision.repository";
export * from "./infrastructure/programacion/consulta-actividad-desde-programacion";
export * from "./infrastructure/http/evidencias.router";
