-- ============================================================
-- Sigmetría HyS — Drop columnas texto legacy reemplazadas por FK
--
-- 1. establecimientos_feedback_clientes.cliente → persona_id ya existe
-- ============================================================

ALTER TABLE public.establecimientos_feedback_clientes
  DROP COLUMN IF EXISTS cliente;
