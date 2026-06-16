-- ============================================================
-- observaciones_clasificaciones: sumar a capability librerias base
-- ============================================================
-- La tabla quedó fuera del rewrite en 20260723000010 porque su nombre
-- no coincidió con el allowlist. Sus write policies (insert + update)
-- siguen gateadas a is_developer().
-- Esta migración las reescribe sustituyendo is_developer() por
-- puede_gestionar_librerias() (= is_developer() OR flag en profiles).
-- No hay rama híbrida consultora_id/NULL: el catálogo es plano.
-- No hay DELETE policy — nunca existió.
-- Idempotente (DROP POLICY IF EXISTS antes de cada CREATE).
-- NO la apliques directamente: el orquestador la aplica vía Management API.
-- ============================================================

BEGIN;

-- ── INSERT ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "observaciones_clasificaciones: insert" ON public.observaciones_clasificaciones;
CREATE POLICY "observaciones_clasificaciones: insert"
  ON public.observaciones_clasificaciones
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (puede_gestionar_librerias());

-- ── UPDATE ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "observaciones_clasificaciones: update" ON public.observaciones_clasificaciones;
CREATE POLICY "observaciones_clasificaciones: update"
  ON public.observaciones_clasificaciones
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (puede_gestionar_librerias());

COMMIT;
