-- ============================================================
-- Sigmetría HyS — Roles + Super Admin
-- 1. Agregar visualizador_comentarista al enum user_role
-- 2. Agregar is_super_admin a profiles + marcar dev@sigmetria.app
-- 3. Función is_super_admin() reemplazando is_developer()
-- 4. Guard trigger (DESPUÉS del UPDATE inicial)
-- 5. Corregir consultoras_members policies
-- 6. Subscription gate en empresas y establecimientos
-- 7. Trigger: trial automático al crear consultora
-- 8. trial_used_at en consultoras
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS profiles_guard_super_admin ON public.profiles;
--   DROP TRIGGER IF EXISTS on_consultora_created ON public.consultoras;
--   DROP FUNCTION IF EXISTS public.guard_super_admin(), public.is_super_admin(), public.handle_new_consultora();
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_super_admin;
--   ALTER TABLE public.consultoras DROP COLUMN IF EXISTS trial_used_at;
-- ============================================================


-- ============================================================
-- 1. Agregar visualizador_comentarista al enum user_role
-- ============================================================
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'visualizador_comentarista';


-- ============================================================
-- 2. is_super_admin en profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Marcar dev@sigmetria.app ANTES de crear el trigger guard
-- (auth.uid() es NULL en contexto de migración, el trigger fallaría)
UPDATE public.profiles
SET is_super_admin = true,
    system_role    = 'developer'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'dev@sigmetria.app'
  LIMIT 1
);


-- ============================================================
-- 3. Funciones is_super_admin() e is_developer()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND is_super_admin = true
  )
$$;

-- is_developer() apunta a is_super_admin() para retrocompatibilidad
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.is_super_admin()
$$;


-- ============================================================
-- 4. Guard trigger — impide que un usuario no-super_admin se eleve
--    Se crea DESPUÉS del UPDATE inicial para no bloquearse a sí mismo
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_super_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    -- En contexto de migración auth.uid() es NULL: permitir
    IF (SELECT auth.uid()) IS NOT NULL AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Solo un super_admin puede modificar is_super_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_super_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_super_admin();


-- ============================================================
-- 5. Corregir consultoras_members policies
-- ============================================================
DROP POLICY IF EXISTS "consultoras_members: insert" ON public.consultoras_members;
CREATE POLICY "consultoras_members: insert"
  ON public.consultoras_members FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id     = (SELECT auth.uid())
          AND cm.consultora_id = consultoras_members.consultora_id
          AND cm.role        = 'full_access_main'
          AND cm.is_active   = true
      )
      AND public.has_active_subscription(consultoras_members.consultora_id)
    )
  );

DROP POLICY IF EXISTS "consultoras_members: update" ON public.consultoras_members;
CREATE POLICY "consultoras_members: update"
  ON public.consultoras_members FOR UPDATE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id     = (SELECT auth.uid())
        AND cm.consultora_id = consultoras_members.consultora_id
        AND cm.role        = 'full_access_main'
        AND cm.is_active   = true
    )
  );

DROP POLICY IF EXISTS "consultoras_members: delete" ON public.consultoras_members;
CREATE POLICY "consultoras_members: delete"
  ON public.consultoras_members FOR DELETE
  USING (
    public.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id     = (SELECT auth.uid())
          AND cm.consultora_id = consultoras_members.consultora_id
          AND cm.role        = 'full_access_main'
          AND cm.is_active   = true
      )
      AND user_id != (SELECT auth.uid())
    )
  );


-- ============================================================
-- 6. Subscription gate en empresas y establecimientos
-- ============================================================
DROP POLICY IF EXISTS "empresas: insert" ON public.empresas;
CREATE POLICY "empresas: insert"
  ON public.empresas FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id     = (SELECT auth.uid())
          AND cm.consultora_id = consultora_id
          AND cm.is_active   = true
          AND cm.role IN ('full_access_main', 'full_access_branch')
      )
      AND public.has_active_subscription(consultora_id)
    )
  );

DROP POLICY IF EXISTS "establecimientos: insert" ON public.establecimientos;
CREATE POLICY "establecimientos: insert"
  ON public.establecimientos FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.has_empresa_write_access(empresa_id)
      AND public.has_active_subscription((
        SELECT e.consultora_id FROM public.empresas e WHERE e.id = empresa_id
      ))
    )
  );


-- ============================================================
-- 7. Trigger: trial automático al crear consultora
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_consultora()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'trial' LIMIT 1;

  INSERT INTO public.subscriptions (
    consultora_id,
    plan_id,
    estado,
    trial_starts_at,
    trial_ends_at,
    grace_period_ends_at
  ) VALUES (
    NEW.id,
    v_plan_id,
    'trialing',
    now(),
    now() + INTERVAL '30 days',
    now() + INTERVAL '30 days' + INTERVAL '90 days'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_consultora_created ON public.consultoras;
CREATE TRIGGER on_consultora_created
  AFTER INSERT ON public.consultoras
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_consultora();


-- ============================================================
-- 8. trial_used_at en consultoras
-- ============================================================
ALTER TABLE public.consultoras
  ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;
