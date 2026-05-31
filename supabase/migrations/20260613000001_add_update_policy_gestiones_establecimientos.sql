-- ============================================================
-- Sigmetría HyS — Add UPDATE policy to gestiones_establecimientos
--
-- La tabla tenía policies de SELECT/INSERT/DELETE pero faltaba UPDATE.
-- Sin esta policy, los toggles como `mostrar_lt` (Legajo Técnico)
-- fallaban silenciosamente — el cliente recibía éxito pero RLS
-- bloqueaba el UPDATE y afectaba 0 filas.
--
-- Permisos: mismo nivel que INSERT (has_establecimiento_write_access).
-- Cualquier usuario que pueda crear gestiones puede modificarlas.
-- ============================================================

DROP POLICY IF EXISTS "gestiones_establecimientos: update" ON public.gestiones_establecimientos;

CREATE POLICY "gestiones_establecimientos: update" ON public.gestiones_establecimientos
  FOR UPDATE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));
