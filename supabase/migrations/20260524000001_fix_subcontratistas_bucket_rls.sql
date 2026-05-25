-- ============================================================
-- Sigmetría HyS — Fix RLS bucket subcontratistas (OWASP C1)
-- Reemplaza policies que solo chequean auth.role() por policies
-- que verifican consultora_id via storage_path_consultora_id()
-- ============================================================

-- 1. Drop old policies (only auth.role())
DROP POLICY IF EXISTS "subcontratistas: select" ON storage.objects;
DROP POLICY IF EXISTS "subcontratistas: insert" ON storage.objects;
DROP POLICY IF EXISTS "subcontratistas: update" ON storage.objects;
DROP POLICY IF EXISTS "subcontratistas: delete" ON storage.objects;

-- 2. Insert (write): miembro activo con rol operativo
CREATE POLICY "subcontratistas: write insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'subcontratistas'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- 3. Update (write): mismo criterio que insert
CREATE POLICY "subcontratistas: write update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'subcontratistas'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- 4. Delete: solo full_access (no colaborador)
CREATE POLICY "subcontratistas: admins delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'subcontratistas'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- 5. Select (read): miembro activo de la consultora (cualquier rol)
CREATE POLICY "subcontratistas: members read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'subcontratistas'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );
