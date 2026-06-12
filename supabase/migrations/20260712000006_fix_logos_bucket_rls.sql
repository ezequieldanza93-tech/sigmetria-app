-- FIX: upload de logo al bucket "logos" fallaba con 42501 / 403 RLS aunque el
-- usuario fuera full_access_main de la consultora del path.
--
-- Causa: la policy multi-bucket "assets: members write insert" (migr 20260521172801)
-- referenciaba public.consultoras_members ANTES del rename (20260522000001), por lo
-- que nunca quedó creada correctamente para estos buckets. Para "consultora" ya se
-- crearon policies dedicadas (20260530000005); "logos" quedó sin policy de escritura.
--
-- Solución: policies dedicadas y explícitas para bucket "logos" (mismo patrón
-- probado del bucket "consultora"). Permissive → se ORean con cualquier policy
-- existente, así que es redundante-pero-inofensiva si algo ya cubría el caso.

-- INSERT: miembro activo con rol de escritura en la consultora del path
DROP POLICY IF EXISTS "logos bucket: insert" ON storage.objects;
CREATE POLICY "logos bucket: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.role          IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- UPDATE: USING + WITH CHECK explícito (necesario para el upsert: true)
DROP POLICY IF EXISTS "logos bucket: update" ON storage.objects;
CREATE POLICY "logos bucket: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.role          IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.role          IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- SELECT: miembros activos de la consultora (logos es público, pero el upsert hace
-- un check interno; lo dejamos explícito por consistencia con el bucket consultora)
DROP POLICY IF EXISTS "logos bucket: select" ON storage.objects;
CREATE POLICY "logos bucket: select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- DELETE: solo admins de la consultora
DROP POLICY IF EXISTS "logos bucket: delete" ON storage.objects;
CREATE POLICY "logos bucket: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.is_active     = true
        AND cm.role          IN ('full_access_main', 'full_access_branch')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );
