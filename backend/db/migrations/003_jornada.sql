-- Migración 003: Módulo de Jornada
-- Registro de hechos con dos horas: capturadoEn (celular) y recibidoEn (servidor)

CREATE TABLE IF NOT EXISTS registros_jornada (
  id UUID PRIMARY KEY,
  operario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('entrada_centro', 'salida_centro', 'inicio_actividad', 'fin_actividad')),
  centro_trabajo_id UUID REFERENCES centros_trabajo(id) ON DELETE RESTRICT,
  actividad_id UUID REFERENCES actividades(id) ON DELETE RESTRICT,
  capturado_en TIMESTAMPTZ NOT NULL,
  recibido_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jornada_operario_fecha ON registros_jornada(operario_id, capturado_en);
CREATE INDEX IF NOT EXISTS idx_jornada_actividad ON registros_jornada(actividad_id);
