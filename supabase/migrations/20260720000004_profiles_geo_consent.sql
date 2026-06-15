-- Migración: consentimiento de geo-sello en perfiles de usuario
-- Registra QUIÉN aceptó el aviso de registro de ubicación y CUÁNDO,
-- junto con la versión del texto mostrado (para auditoría ante cambios futuros).
--
-- Versión inicial: 'v1' (texto mostrado en GeoConsentModal, junio 2026).
-- Si se actualiza el texto del aviso, se crea una nueva versión ('v2', etc.)
-- y se puede re-solicitar el consentimiento a los usuarios con versión anterior.

ALTER TABLE public.profiles
  -- Timestamp del momento exacto en que el usuario aceptó el aviso.
  -- NULL = todavía no aceptó (se mostrará el modal al ingresar al dashboard).
  ADD COLUMN IF NOT EXISTS accepted_geo_consent_at timestamptz,

  -- Versión del texto del aviso aceptado.
  -- Permite detectar si un usuario aceptó una versión anterior cuando el texto cambia.
  ADD COLUMN IF NOT EXISTS geo_consent_version text;

COMMENT ON COLUMN public.profiles.accepted_geo_consent_at IS
  'Timestamp en que el usuario aceptó el aviso de registro de geolocalización al completar gestiones. NULL = no aceptó aún.';

COMMENT ON COLUMN public.profiles.geo_consent_version IS
  'Versión del texto del aviso de geo-sello aceptado (ej: "v1"). Permite re-solicitar consentimiento si el texto cambia.';
