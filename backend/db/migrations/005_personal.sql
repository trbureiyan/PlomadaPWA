-- Migración 005: Módulo de Personal
-- Hojas de vida de operarios

CREATE TABLE IF NOT EXISTS hojas_de_vida (
  operario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(255) NOT NULL,
  tipo_documento VARCHAR(10) NOT NULL DEFAULT 'CC',
  numero_documento VARCHAR(50) NOT NULL,
  telefono VARCHAR(50),
  cargo VARCHAR(100) NOT NULL,
  fecha_ingreso DATE NOT NULL,
  formacion JSONB NOT NULL DEFAULT '[]'::jsonb,
  experiencia JSONB NOT NULL DEFAULT '[]'::jsonb,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
