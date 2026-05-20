-- ============================================================
-- Fix RLS recursion: policies calling get_consultora_role which
-- reads consultoras_members, whose policy calls get_consultora_role.
-- Replace get_consultora_role() in policies with direct EXISTS.
-- ============================================================

-- empresas: insert — use direct EXISTS, avoid get_consultora_role
DROP POLICY IF EXISTS "empresas: insert" ON public.empresas;
CREATE POLICY "empresas: insert"
  ON public.empresas FOR INSERT
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.consultora_id = consultora_id
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );

-- consultoras_members: select — avoid self-referencing get_consultora_role
DROP POLICY IF EXISTS "consultoras_members: select" ON public.consultoras_members;
CREATE POLICY "consultoras_members: select"
  ON public.consultoras_members FOR SELECT
  USING (is_developer() OR user_id = (SELECT auth.uid()));

-- consultoras_members: insert — only developers can insert
DROP POLICY IF EXISTS "consultoras_members: insert" ON public.consultoras_members;
CREATE POLICY "consultoras_members: insert"
  ON public.consultoras_members FOR INSERT
  WITH CHECK (is_developer());
