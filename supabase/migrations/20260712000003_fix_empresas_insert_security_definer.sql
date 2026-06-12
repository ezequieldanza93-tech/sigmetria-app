-- FIX: el INSERT de empresas fallaba la RLS aunque el usuario fuera full_access_main
-- con suscripción activa. Causa: la policy usaba un EXISTS INLINE sobre
-- consultoras_members, que arrastra la RLS de esa tabla evaluada en el contexto
-- anidado del INSERT (devuelve vacío). La de establecimientos no falla porque usa
-- has_empresa_write_access() (SECURITY DEFINER, sin RLS anidada).
--
-- Solución: encapsular el chequeo en can_create_empresa() SECURITY DEFINER (corre
-- como owner → sin RLS anidada → confiable), igual que el resto de helpers.

CREATE OR REPLACE FUNCTION public.can_create_empresa(p_consultora_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.user_id      = (SELECT auth.uid())
      AND cm.consultora_id = p_consultora_id
      AND cm.is_active     = true
      AND cm.role IN ('full_access_main', 'full_access_branch')
  ) AND public.has_active_subscription(p_consultora_id)
$$;

REVOKE ALL ON FUNCTION public.can_create_empresa(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_create_empresa(uuid) TO authenticated;

DROP POLICY IF EXISTS "empresas: insert" ON public.empresas;
CREATE POLICY "empresas: insert"
  ON public.empresas FOR INSERT TO authenticated
  WITH CHECK ( public.is_super_admin() OR public.can_create_empresa(consultora_id) );
