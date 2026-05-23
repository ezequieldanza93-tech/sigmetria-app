-- ============================================================
-- Sigmetría HyS — Enable Realtime for notificaciones
--
-- Permite que el frontend reciba notificaciones en vivo
-- via Supabase Realtime.
--
-- ROLLBACK:
--   ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.notificaciones;
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.notificaciones;
