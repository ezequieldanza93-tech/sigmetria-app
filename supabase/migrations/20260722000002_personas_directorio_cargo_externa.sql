-- ============================================================
-- personas_directorio: cargo + marca de persona externa
-- ============================================================
-- Las primitivas de selección de personas (PersonaSelectorConAlta /
-- PersonaMultiSelectConSueltos) permiten dar de alta personas inline en el
-- directorio con campos mínimos. Para soportar:
--   1) un `cargo` opcional al dar de alta una persona (texto libre del puesto
--      o función con la que se la carga desde un formulario), y
--   2) marcar a la persona como EXTERNA (instructores/participantes externos,
--      terceros que no pertenecen a la consultora ni al establecimiento),
-- se agregan dos columnas a `personas_directorio`.
--
-- ADITIVA e idempotente:
--   - `cargo text` nullable → conserva todo el resto del esquema intacto.
--   - `es_externa boolean NOT NULL DEFAULT false` → las personas existentes
--     quedan como NO externas (default), sin necesidad de backfill.
--   - No se crean políticas RLS nuevas: las columnas heredan la RLS de la
--     tabla `personas_directorio` (mismo patrón que las columnas agregadas en
--     20260530000002 — talles, contacto de emergencia, etc.).
-- ============================================================

BEGIN;

ALTER TABLE public.personas_directorio
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS es_externa boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.personas_directorio.cargo IS
  'Cargo / función con la que se cargó la persona desde un formulario (opcional, texto libre).';

COMMENT ON COLUMN public.personas_directorio.es_externa IS
  'true = persona externa a la consultora/establecimiento (instructor o participante externo, tercero). Default false.';

-- Índice parcial para listar rápido a las personas externas cuando se filtre por esa condición.
CREATE INDEX IF NOT EXISTS idx_personas_directorio_externa
  ON public.personas_directorio (es_externa)
  WHERE es_externa = true;

COMMIT;
