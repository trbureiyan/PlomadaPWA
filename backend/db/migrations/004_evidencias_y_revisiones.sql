-- Migración 004: Módulo de Evidencias y Revisiones
-- Fotografías antes, durante y después; revisiones presenciales del supervisor

CREATE TABLE IF NOT EXISTS evidencias (
  id UUID PRIMARY KEY,
  actividad_id UUID NOT NULL REFERENCES actividades(id) ON DELETE RESTRICT,
  operario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('antes', 'durante', 'despues')),
  capturada_en TIMESTAMPTZ NOT NULL,
  recibida_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo_mime VARCHAR(100) NOT NULL,
  tamano_bytes INTEGER NOT NULL,
  foto_ruta VARCHAR(500) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidencias_actividad ON evidencias(actividad_id);
CREATE INDEX IF NOT EXISTS idx_evidencias_operario ON evidencias(operario_id);

CREATE TABLE IF NOT EXISTS revisiones (
  actividad_id UUID PRIMARY KEY REFERENCES actividades(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  resultado VARCHAR(50) NOT NULL CHECK (resultado IN ('aprobada', 'rechazada')),
  observacion TEXT,
  revisada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revisiones_supervisor ON revisiones(supervisor_id);
