-- Migración 001: Módulo de Identidad
-- Usuarios del sistema y control de sesiones con tokens de refresco rotativos

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  correo VARCHAR(255) UNIQUE NOT NULL,
  rol VARCHAR(50) NOT NULL CHECK (rol IN ('administrador', 'administrativo', 'supervisor', 'operario')),
  contrasena_hash VARCHAR(255) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);

CREATE TABLE IF NOT EXISTS sesiones (
  id UUID PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_refresco_hash VARCHAR(255) NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  revocado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token_refresco_hash);
