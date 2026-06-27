-- Fix: agregar UPDATE policy faltante para contenido_hashtags
--
-- El error "new row violates row-level security policy (USING expression)"
-- ocurría al hacer upsert sobre un hashtag existente. El upsert de PostgREST
-- hace INSERT (ok, policy exists) + UPDATE en conflicto (faltaba policy).
--
-- El vocabulario de hashtags es compartido entre todas las consultoras:
-- cualquier authenticated puede crear/modificar.

DROP POLICY IF EXISTS "contenido_hashtags: update" ON public.contenido_hashtags;
CREATE POLICY "contenido_hashtags: update" ON public.contenido_hashtags
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
