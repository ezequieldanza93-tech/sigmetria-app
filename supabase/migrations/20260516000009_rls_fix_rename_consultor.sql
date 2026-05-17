-- ============================================================
-- Migration 009: RLS fix + rename organizaciones + Consultor seed
-- ============================================================


-- ============================================================
-- 1. Fix directorio_personas RLS
--    The INSERT policy existed but was overly permissive or failed.
--    Replacing with explicit consultora-scoped policies.
-- ============================================================

DROP POLICY IF EXISTS "directorio_personas: insert" ON public.directorio_personas;
DROP POLICY IF EXISTS "directorio_personas: select" ON public.directorio_personas;
DROP POLICY IF EXISTS "directorio_personas: update" ON public.directorio_personas;
DROP POLICY IF EXISTS "directorio_personas: delete" ON public.directorio_personas;

-- SELECT: any active consultora member (global directory, not scoped to establishment)
CREATE POLICY "directorio_personas: select" ON public.directorio_personas
  FOR SELECT TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
    )
  );

-- INSERT: consultora members with operational role
CREATE POLICY "directorio_personas: insert" ON public.directorio_personas
  FOR INSERT TO authenticated
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

-- UPDATE: consultora members with operational role
CREATE POLICY "directorio_personas: update" ON public.directorio_personas
  FOR UPDATE TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

-- DELETE: admins only
CREATE POLICY "directorio_personas: delete" ON public.directorio_personas
  FOR DELETE TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );


-- ============================================================
-- 2. Seed 'Consultor' into tipo_personas
-- ============================================================
INSERT INTO public.tipo_personas (nombre) VALUES ('Consultor') ON CONFLICT (nombre) DO NOTHING;


-- ============================================================
-- 3. Rename organizaciones → organizaciones_externas
--    PostgreSQL automatically updates all FK references.
-- ============================================================
ALTER TABLE public.organizaciones RENAME TO organizaciones_externas;

-- Also rename the junction table for consistency
ALTER TABLE public.organizacion_establecimiento
  RENAME CONSTRAINT organizacion_establecimiento_organizacion_id_fkey
  TO organizacion_establecimiento_org_ext_id_fkey;
