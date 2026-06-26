-- ============================================================
-- ART como librería híbrida (patrón IPERC/EPP)
-- ============================================================
--
-- QUÉ HACE:
-- Reemplaza el modelo viejo de ART (scope 'global' | 'empresa' + empresa_id)
-- por el patrón híbrido estándar de Sigmetría:
--   - ART BASE de Sigmetría  → consultora_id IS NULL  (las ven TODAS las consultoras)
--   - ART propia de consultora → consultora_id = <consultora>  (solo esa consultora)
--
-- Antes, una ART agregada por una consultora quedaba como scope='global'
-- (visible para todos) o scope='empresa' (atada a UNA empresa, no reutilizable
-- en toda la consultora). Ahora las ART propias son CONSULTORA-PRIVADAS y
-- reutilizables por toda la consultora, igual que IPERC/EPP propios.
--
-- IMPORTANTE: `organizaciones_externas` alberga varios tipos (ART, Marca,
-- Subcontratista, organismos, etc.). Esta migración solo agrega la columna y
-- backfillea las ART; los demás tipos no se tocan. El `scope` viejo se conserva
-- (no se dropea) para no romper otros consumidores; el modelo nuevo se basa en
-- `consultora_id`.
--
-- ROLLBACK:
--   ALTER TABLE public.organizaciones_externas DROP COLUMN IF EXISTS consultora_id;
-- ============================================================

BEGIN;

-- 1. Nueva columna de propiedad por consultora (NULL = base/Sigmetría).
ALTER TABLE public.organizaciones_externas
  ADD COLUMN IF NOT EXISTS consultora_id uuid
    REFERENCES public.consultoras(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_org_ext_consultora_id
  ON public.organizaciones_externas(consultora_id)
  WHERE consultora_id IS NOT NULL;

-- 2. Backfill de las ART propias existentes (scope='empresa' + empresa_id):
--    pasan a ser CONSULTORA-PRIVADAS resolviendo la consultora desde la empresa.
--    Así no desaparecen del selector (que ahora filtra por consultora_id).
UPDATE public.organizaciones_externas oe
SET consultora_id = e.consultora_id
FROM public.empresas e
WHERE oe.empresa_id = e.id
  AND oe.scope = 'empresa'
  AND oe.consultora_id IS NULL;

-- 3. Las ART 'global' quedan como BASE de Sigmetría → consultora_id permanece NULL.
--    (no se hace nada; es el estado por defecto de la columna nueva)

COMMIT;
