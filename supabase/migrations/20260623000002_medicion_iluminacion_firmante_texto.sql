-- ============================================================
-- Medición de Iluminación: firmante como campo de texto libre
-- ============================================================
-- Decisión del cliente: simplificar el firmante del protocolo. En vez de
-- depender de Usuarios/perfiles_profesionales (FK perfil_profesional_id),
-- el firmante se carga como texto libre (nombre + matrícula) en la cabecera.
--
-- ADITIVA e idempotente: agrega la columna `firmante` (text). NO se borra
-- `perfil_profesional_id` — queda nullable para retomar el vínculo a perfiles
-- en el futuro.
-- ============================================================

ALTER TABLE public.medicion_iluminacion ADD COLUMN IF NOT EXISTS firmante text;

COMMENT ON COLUMN public.medicion_iluminacion.firmante IS
  'Profesional firmante del protocolo como texto libre (nombre y matrícula). Reemplaza la dependencia de perfil_profesional_id, que queda nullable para uso futuro.';
