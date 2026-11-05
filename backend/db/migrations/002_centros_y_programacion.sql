-- Migración 002: Módulo de Programación
-- Centros de trabajo, programaciones semanales, asignaciones y actividades

CREATE TABLE IF NOT EXISTS centros_trabajo (
  id UUID PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  direccion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programaciones_semanales (
  id UUID PRIMARY KEY,
  semana_inicio DATE NOT NULL UNIQUE,
  estado VARCHAR(50) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
  publicada_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programaciones_semana ON programaciones_semanales(semana_inicio);

CREATE TABLE IF NOT EXISTS asignaciones (
  id UUID PRIMARY KEY,
  programacion_id UUID NOT NULL REFERENCES programaciones_semanales(id) ON DELETE CASCADE,
  operario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  centro_trabajo_id UUID NOT NULL REFERENCES centros_trabajo(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_programacion ON asignaciones(programacion_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_operario_fecha ON asignaciones(operario_id, fecha);

CREATE TABLE IF NOT EXISTS actividades (
  id UUID PRIMARY KEY,
  asignacion_id UUID NOT NULL REFERENCES asignaciones(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actividades_asignacion ON actividades(asignacion_id);
