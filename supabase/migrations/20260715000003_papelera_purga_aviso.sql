-- ============================================================
-- Papelera Fase 2 — aviso de purga (72hs antes de los 90 días)
-- ============================================================
-- La PURGA a 90 días es LÓGICA (no-recuperable por fecha, SIN borrado físico):
-- lib/actions/papelera.ts (listarPapelera/restaurarDePapelera) excluye los
-- registros cuyo deleted_at supera los 90 días. La fila NUNCA se borra (la
-- cadena de custodia Disp. 15/2026 queda intacta), solo deja de aparecer en la
-- papelera y de poder restaurarse.
--
-- Esta migración agrega únicamente `purga_aviso_at`: marca cuándo se envió el
-- aviso "se va a purgar en 72hs", para que el cron diario NO re-avise.
-- Idempotente.
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['empresas', 'establecimientos', 'establecimientos_sectores', 'puestos_de_trabajo']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS purga_aviso_at timestamptz;', t);
    EXECUTE format($f$COMMENT ON COLUMN public.%I.purga_aviso_at IS 'Cuándo se avisó la purga inminente (72hs antes de los 90 días en papelera). NULL = aún no avisado.';$f$, t);
  END LOOP;
END $$;
