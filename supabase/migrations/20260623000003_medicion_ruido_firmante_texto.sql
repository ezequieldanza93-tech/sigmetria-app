-- ============================================================
-- Protocolo de Medición de Ruido — firmante como TEXTO LIBRE
-- ============================================================
-- ADITIVA e idempotente. Agrega la columna `firmante` (text) a la cabecera
-- del protocolo de ruido, mismo patrón que medicion_iluminacion: el firmante
-- se guarda como texto libre (nombre y matrícula) en vez de depender de un FK
-- a perfiles_profesionales. La columna perfil_profesional_id queda intacta
-- (no se elimina) para no romper datos previos; las server actions usan
-- `firmante`. NO toca datos existentes.
-- ============================================================

ALTER TABLE public.medicion_ruido ADD COLUMN IF NOT EXISTS firmante text;

COMMENT ON COLUMN public.medicion_ruido.firmante IS
  'Firmante del protocolo como texto libre (nombre y matrícula). Reemplaza la dependencia de perfil_profesional_id en el flujo de ejecución.';
