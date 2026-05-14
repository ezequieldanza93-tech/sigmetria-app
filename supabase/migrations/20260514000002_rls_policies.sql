-- ============================================================
-- Sigmetria App — RLS Policies
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — bypasan RLS al leer)
-- Usamos (SELECT auth.uid()) en vez de auth.uid() para que
-- Postgres cachee el valor y no lo reevalúe por cada fila.
-- ============================================================

-- 1. ¿Es el usuario el developer del sistema?
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND system_role = 'developer'
  )
$$;

-- 2. Rol del usuario en una consultora (NULL si no es miembro)
CREATE OR REPLACE FUNCTION public.get_consultora_role(p_consultora_id uuid)
RETURNS public.user_role
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM public.consultora_members
  WHERE user_id = (SELECT auth.uid())
    AND consultora_id = p_consultora_id
    AND is_active = true
  LIMIT 1
$$;

-- 3. ¿Puede leer esta empresa?
--    - Roles amplios (main/branch/viewer): ven todas las de su consultora
--    - Colaboradores: solo las que tienen en user_access
CREATE OR REPLACE FUNCTION public.has_empresa_read_access(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultora_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND e.id = p_empresa_id
        AND cm.role IN ('full_access_main','full_access_branch','full_viewer')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_access ua
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.empresa_id = p_empresa_id
        AND ua.is_active = true
    )
$$;

-- 4. ¿Puede escribir en esta empresa?
--    - main/branch: todas las de su consultora
--    - colaborador (no viewer): solo las explícitamente asignadas
CREATE OR REPLACE FUNCTION public.has_empresa_write_access(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultora_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND e.id = p_empresa_id
        AND cm.role IN ('full_access_main','full_access_branch')
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN public.consultora_members cm
        ON cm.user_id = ua.user_id
       AND cm.consultora_id = ua.consultora_id
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.empresa_id = p_empresa_id
        AND ua.is_active = true
        AND cm.role = 'colaborador'
    )
$$;

-- 5. ¿Puede leer este establecimiento?
--    - main/branch/viewer: todos los de su consultora
--    - colaborador (cualquier tipo): acceso a empresa entera o al establecimiento puntual
CREATE OR REPLACE FUNCTION public.has_establecimiento_read_access(p_establecimiento_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultora_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      JOIN public.establecimientos est ON est.empresa_id = e.id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND est.id = p_establecimiento_id
        AND cm.role IN ('full_access_main','full_access_branch','full_viewer')
    )
    OR EXISTS (
      -- Acceso a empresa entera → puede ver todos sus establecimientos
      SELECT 1
      FROM public.user_access ua
      JOIN public.establecimientos est ON est.empresa_id = ua.empresa_id
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.is_active = true
        AND ua.establecimiento_id IS NULL
        AND est.id = p_establecimiento_id
    )
    OR EXISTS (
      -- Acceso explícito al establecimiento puntual
      SELECT 1 FROM public.user_access ua
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.establecimiento_id = p_establecimiento_id
        AND ua.is_active = true
    )
$$;

-- 6. ¿Puede escribir en este establecimiento?
--    Solo colaborador (no viewer) con acceso a empresa entera o al puntual
CREATE OR REPLACE FUNCTION public.has_establecimiento_write_access(p_establecimiento_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultora_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      JOIN public.establecimientos est ON est.empresa_id = e.id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND est.id = p_establecimiento_id
        AND cm.role IN ('full_access_main','full_access_branch')
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN public.establecimientos est ON est.empresa_id = ua.empresa_id
      JOIN public.consultora_members cm
        ON cm.user_id = ua.user_id
       AND cm.consultora_id = ua.consultora_id
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.is_active = true
        AND ua.establecimiento_id IS NULL
        AND est.id = p_establecimiento_id
        AND cm.role = 'colaborador'
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN public.consultora_members cm
        ON cm.user_id = ua.user_id
       AND cm.consultora_id = ua.consultora_id
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.establecimiento_id = p_establecimiento_id
        AND ua.is_active = true
        AND cm.role = 'colaborador'
    )
$$;


-- ============================================================
-- TRIGGER: impide que un usuario no-developer cambie system_role
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_system_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.system_role IS DISTINCT FROM OLD.system_role AND NOT is_developer() THEN
    RAISE EXCEPTION 'Solo el developer puede modificar system_role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_system_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.guard_system_role();


-- ============================================================
-- POLICIES: profiles
-- ============================================================
-- SELECT: propio perfil siempre; developer todo; mismo-consultora entre sí
CREATE POLICY "profiles: select"
  ON public.profiles FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultora_members a
      JOIN public.consultora_members b ON a.consultora_id = b.consultora_id
      WHERE a.user_id = (SELECT auth.uid())
        AND b.user_id = profiles.id
        AND a.is_active = true
        AND b.is_active = true
    )
  );

-- INSERT: el trigger on_auth_user_created (SECURITY DEFINER) maneja el caso normal.
-- Solo developer puede insertar manualmente.
CREATE POLICY "profiles: insert"
  ON public.profiles FOR INSERT
  WITH CHECK (is_developer());

-- UPDATE: cada uno puede editar su propio perfil; developer edita cualquiera.
-- El trigger guard_system_role impide cambios de system_role a no-developers.
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles: update any (developer)"
  ON public.profiles FOR UPDATE
  USING (is_developer());

-- DELETE: solo developer (la cascada de auth.users lo maneja automáticamente)
CREATE POLICY "profiles: delete"
  ON public.profiles FOR DELETE
  USING (is_developer());


-- ============================================================
-- POLICIES: consultoras
-- ============================================================
CREATE POLICY "consultoras: select"
  ON public.consultoras FOR SELECT
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members
      WHERE user_id = (SELECT auth.uid())
        AND consultora_id = consultoras.id
        AND is_active = true
    )
  );

-- INSERT: cualquier usuario autenticado puede crear su consultora (onboarding).
-- La app asigna automáticamente al creador como full_access_main.
CREATE POLICY "consultoras: insert"
  ON public.consultoras FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- UPDATE: developer o full_access_main de esa consultora
CREATE POLICY "consultoras: update"
  ON public.consultoras FOR UPDATE
  USING (
    is_developer()
    OR get_consultora_role(id) = 'full_access_main'
  );

-- DELETE: solo developer
CREATE POLICY "consultoras: delete"
  ON public.consultoras FOR DELETE
  USING (is_developer());


-- ============================================================
-- POLICIES: consultora_members
-- ============================================================
CREATE POLICY "consultora_members: select"
  ON public.consultora_members FOR SELECT
  USING (
    is_developer()
    OR user_id = (SELECT auth.uid())
    OR get_consultora_role(consultora_id) IS NOT NULL
  );

-- INSERT/UPDATE/DELETE: solo developer o full_access_main de esa consultora
CREATE POLICY "consultora_members: insert"
  ON public.consultora_members FOR INSERT
  WITH CHECK (
    is_developer()
    OR get_consultora_role(consultora_id) = 'full_access_main'
  );

CREATE POLICY "consultora_members: update"
  ON public.consultora_members FOR UPDATE
  USING (
    is_developer()
    OR get_consultora_role(consultora_id) = 'full_access_main'
  );

-- No puede removerse a sí mismo (para que no se quede la consultora sin admin)
CREATE POLICY "consultora_members: delete"
  ON public.consultora_members FOR DELETE
  USING (
    is_developer()
    OR (
      get_consultora_role(consultora_id) = 'full_access_main'
      AND user_id != (SELECT auth.uid())
    )
  );


-- ============================================================
-- POLICIES: empresas
-- ============================================================
CREATE POLICY "empresas: select"
  ON public.empresas FOR SELECT
  USING (has_empresa_read_access(id));

-- INSERT: solo admins agregan nuevos clientes (no colaboradores)
CREATE POLICY "empresas: insert"
  ON public.empresas FOR INSERT
  WITH CHECK (
    is_developer()
    OR get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')
  );

CREATE POLICY "empresas: update"
  ON public.empresas FOR UPDATE
  USING (has_empresa_write_access(id));

CREATE POLICY "empresas: delete"
  ON public.empresas FOR DELETE
  USING (has_empresa_write_access(id));


-- ============================================================
-- POLICIES: establecimientos
-- ============================================================
CREATE POLICY "establecimientos: select"
  ON public.establecimientos FOR SELECT
  USING (has_establecimiento_read_access(id));

-- INSERT: admins siempre; colaborador con acceso a empresa entera (no al puntual)
CREATE POLICY "establecimientos: insert"
  ON public.establecimientos FOR INSERT
  WITH CHECK (
    is_developer()
    OR has_empresa_write_access(empresa_id)
  );

CREATE POLICY "establecimientos: update"
  ON public.establecimientos FOR UPDATE
  USING (has_establecimiento_write_access(id));

CREATE POLICY "establecimientos: delete"
  ON public.establecimientos FOR DELETE
  USING (has_establecimiento_write_access(id));


-- ============================================================
-- POLICIES: user_access
-- ============================================================
-- SELECT: developer todo; full_access_main/branch ven todos los grants de su consultora;
--         el resto solo ve los suyos
CREATE POLICY "user_access: select"
  ON public.user_access FOR SELECT
  USING (
    is_developer()
    OR user_id = (SELECT auth.uid())
    OR get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')
  );

-- INSERT/UPDATE/DELETE: solo developer o full_access_main
CREATE POLICY "user_access: insert"
  ON public.user_access FOR INSERT
  WITH CHECK (
    is_developer()
    OR get_consultora_role(consultora_id) = 'full_access_main'
  );

CREATE POLICY "user_access: update"
  ON public.user_access FOR UPDATE
  USING (
    is_developer()
    OR get_consultora_role(consultora_id) = 'full_access_main'
  );

CREATE POLICY "user_access: delete"
  ON public.user_access FOR DELETE
  USING (
    is_developer()
    OR get_consultora_role(consultora_id) = 'full_access_main'
  );
