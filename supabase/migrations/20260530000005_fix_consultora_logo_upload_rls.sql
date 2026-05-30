-- ============================================================
-- Fix: RLS para upload de logo en bucket "consultora"
--
-- Diagnóstico:
--   1. La migración 20260521172801_storage_assets_buckets.sql creó
--      la política multi-bucket "assets: members write insert" usando
--      consultoras_members ANTES de que la tabla existiera con ese nombre
--      (el rename ocurrió en 20260522000001). En PostgreSQL, los cuerpos
--      de las políticas se validan en tiempo de creación; si la tabla no
--      existía, la política nunca se creó correctamente.
--
--   2. La política "assets: members write update" no tiene WITH CHECK
--      explícito. PostgreSQL usa USING como WITH CHECK en ese caso, lo
--      que puede fallar en edge cases con la función get_consultora_role
--      (VOLATILE, sin search_path fijo — ver 20260605000001).
--
--   3. uploadConsultoraLogo no chequeaba el error del UPDATE final en
--      consultoras, por lo que el logo no se persistía aunque el upload
--      al bucket tuviera éxito.
--
-- Solución:
--   A. Recrear storage_path_consultora_id (CREATE OR REPLACE — idempotente).
--   B. Crear políticas EXPLÍCITAS y SEPARADAS para el bucket "consultora",
--      con WITH CHECK en UPDATE (evita la ambigüedad de USING-as-CHECK).
--      Estas se ORean con las políticas multi-bucket existentes: si alguna
--      ya funciona, esta es redundante-pero-inofensiva; si falta, cubre el gap.
--   C. Recrear "consultoras: update" con EXISTS directo + WITH CHECK explícito
--      para garantizar que el UPDATE de logo_url persista en la tabla.
-- ============================================================

-- ─── A. Función helper ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.storage_path_consultora_id(p_path text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  parts text[];
BEGIN
  parts := string_to_array(p_path, '/');
  IF parts IS NULL OR array_length(parts, 1) < 1 THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN parts[1]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;

-- ─── B. Políticas dedicadas para bucket "consultora" ──────────

-- INSERT: miembro activo con rol de escritura en la consultora del path
DROP POLICY IF EXISTS "consultora bucket: insert" ON storage.objects;
CREATE POLICY "consultora bucket: insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consultora'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.role          IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- UPDATE: USING + WITH CHECK explícito (evita el bug de USING-as-CHECK)
DROP POLICY IF EXISTS "consultora bucket: update" ON storage.objects;
CREATE POLICY "consultora bucket: update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'consultora'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.role          IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  )
  WITH CHECK (
    bucket_id = 'consultora'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.role          IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- SELECT: miembros activos de la consultora (necesario para el upsert check interno)
DROP POLICY IF EXISTS "consultora bucket: select" ON storage.objects;
CREATE POLICY "consultora bucket: select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'consultora'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- DELETE: solo admins de la consultora (full_access_main y branch)
DROP POLICY IF EXISTS "consultora bucket: delete" ON storage.objects;
CREATE POLICY "consultora bucket: delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'consultora'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.role          IN ('full_access_main', 'full_access_branch')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- ─── C. Fix policy "consultoras: update" ─────────────────────
-- La policy original usa get_consultora_role() (VOLATILE post-rename fix)
-- sin WITH CHECK explícito → PostgreSQL usa USING como WITH CHECK,
-- lo que puede fallar. Reemplazar con EXISTS directo + WITH CHECK explícito.
-- (Idéntico al fix de 20260605000001 — aplica ahora para garantizar
-- que logo_url se persiste en el UPDATE post-upload.)
DROP POLICY IF EXISTS "consultoras: update" ON public.consultoras;

CREATE POLICY "consultoras: update"
  ON public.consultoras FOR UPDATE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.consultora_id = consultoras.id
        AND cm.role          = 'full_access_main'
        AND cm.is_active     = true
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.consultora_id = consultoras.id
        AND cm.role          = 'full_access_main'
        AND cm.is_active     = true
    )
  );
