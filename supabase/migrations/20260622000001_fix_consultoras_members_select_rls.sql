-- ============================================================
-- Fix: consultoras_members SELECT scopeada por consultora.
--
-- La policy SELECT actual ("consultoras_members: select", creada en
-- 20260522000005_fix_rls_recursion.sql) es:
--   is_developer() OR user_id = auth.uid()
-- Eso hace que un full_access_main (NO super_admin) solo se vea a sí
-- mismo y NO al resto de su equipo. A diferencia de profiles/subscriptions
-- (que sí scopean por consultora), acá falta el scope.
--
-- No podemos meter un EXISTS sobre la propia consultoras_members dentro
-- de su policy: eso recursa (la policy llama a una query que vuelve a
-- evaluar la policy). Por eso usamos una función SECURITY DEFINER que
-- saltea RLS y rompe la recursión, igual que is_developer()/is_super_admin().
-- ============================================================

-- 1. Función SECURITY DEFINER: ¿el usuario actual es miembro activo de
--    esta consultora? Evita recursión de RLS sobre consultoras_members.
CREATE OR REPLACE FUNCTION public.is_active_member_of(p_consultora_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.consultora_id = p_consultora_id
      AND cm.is_active
  );
$$;

-- 2. Recrear la policy SELECT agregando el scope por consultora.
--    Se mantienen is_developer() y user_id = auth.uid() (este último
--    garantiza que un usuario sin membresía activa siga viendo su
--    propia fila).
DROP POLICY IF EXISTS "consultoras_members: select" ON public.consultoras_members;
CREATE POLICY "consultoras_members: select"
  ON public.consultoras_members FOR SELECT
  USING (
    is_developer()
    OR user_id = (SELECT auth.uid())
    OR public.is_active_member_of(consultora_id)
  );
