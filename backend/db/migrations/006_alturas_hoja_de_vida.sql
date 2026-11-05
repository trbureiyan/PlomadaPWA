-- Migración 006: Certificación en alturas en hojas de vida
ALTER TABLE hojas_de_vida ADD COLUMN IF NOT EXISTS curso_alturas BOOLEAN DEFAULT FALSE;
ALTER TABLE hojas_de_vida ADD COLUMN IF NOT EXISTS vencimiento_alturas DATE;
