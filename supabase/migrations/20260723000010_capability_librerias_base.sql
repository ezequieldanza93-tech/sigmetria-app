-- ============================================================
-- Capability acotada: gestion de librerias base (sin super-admin)
-- ============================================================
-- admin.main (y cualquier perfil con profiles.gestiona_librerias_base=true)
-- administra SOLO los catalogos base (librerias), NO el resto del poder de
-- staff. Se agrega el flag + la funcion puede_gestionar_librerias() (=
-- is_developer() OR flag) y se reescriben SOLO las write policies de los
-- catalogos base sustituyendo is_developer() -> puede_gestionar_librerias().
-- Generada leyendo pg_policies en vivo. Idempotente.
-- ============================================================

BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gestiona_librerias_base boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.gestiona_librerias_base IS 'true = administra los catalogos/librerias base (consultora_id NULL) sin ser super-admin.';

CREATE OR REPLACE FUNCTION public.puede_gestionar_librerias()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $func$
  SELECT public.is_developer() OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND gestiona_librerias_base = true
  )
$func$;

DROP POLICY IF EXISTS "documentos_tipos: delete" ON public.documentos_tipos;
CREATE POLICY "documentos_tipos: delete" ON public.documentos_tipos AS PERMISSIVE FOR DELETE TO public
  USING (puede_gestionar_librerias());

DROP POLICY IF EXISTS "documentos_tipos: insert" ON public.documentos_tipos;
CREATE POLICY "documentos_tipos: insert" ON public.documentos_tipos AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "documentos_tipos: update" ON public.documentos_tipos;
CREATE POLICY "documentos_tipos: update" ON public.documentos_tipos AS PERMISSIVE FOR UPDATE TO public
  USING (puede_gestionar_librerias());

DROP POLICY IF EXISTS "documentos_tipos_reglas: delete" ON public.documentos_tipos_reglas;
CREATE POLICY "documentos_tipos_reglas: delete" ON public.documentos_tipos_reglas AS PERMISSIVE FOR DELETE TO authenticated
  USING (puede_gestionar_librerias());

DROP POLICY IF EXISTS "documentos_tipos_reglas: insert" ON public.documentos_tipos_reglas;
CREATE POLICY "documentos_tipos_reglas: insert" ON public.documentos_tipos_reglas AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "dtte_write" ON public.documentos_tipos_tipos_establecimiento;
CREATE POLICY "dtte_write" ON public.documentos_tipos_tipos_establecimiento AS PERMISSIVE FOR ALL TO public
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "gestiones: delete" ON public.gestiones;
CREATE POLICY "gestiones: delete" ON public.gestiones AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "gestiones: insert" ON public.gestiones;
CREATE POLICY "gestiones: insert" ON public.gestiones AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "gestiones: update" ON public.gestiones;
CREATE POLICY "gestiones: update" ON public.gestiones AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "gestiones_categorias: delete" ON public.gestiones_categorias;
CREATE POLICY "gestiones_categorias: delete" ON public.gestiones_categorias AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "gestiones_categorias: insert" ON public.gestiones_categorias;
CREATE POLICY "gestiones_categorias: insert" ON public.gestiones_categorias AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "gestiones_categorias: update" ON public.gestiones_categorias;
CREATE POLICY "gestiones_categorias: update" ON public.gestiones_categorias AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "gestiones_grupos: delete" ON public.gestiones_grupos;
CREATE POLICY "gestiones_grupos: delete" ON public.gestiones_grupos AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "gestiones_grupos: insert" ON public.gestiones_grupos;
CREATE POLICY "gestiones_grupos: insert" ON public.gestiones_grupos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "gestiones_grupos: update" ON public.gestiones_grupos;
CREATE POLICY "gestiones_grupos: update" ON public.gestiones_grupos AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "iperc_consecuencia_items_delete" ON public.iperc_consecuencia_items;
CREATE POLICY "iperc_consecuencia_items_delete" ON public.iperc_consecuencia_items AS PERMISSIVE FOR DELETE TO authenticated
  USING (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_consecuencia_items_insert" ON public.iperc_consecuencia_items;
CREATE POLICY "iperc_consecuencia_items_insert" ON public.iperc_consecuencia_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_consecuencia_items_update" ON public.iperc_consecuencia_items;
CREATE POLICY "iperc_consecuencia_items_update" ON public.iperc_consecuencia_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_consecuencias_delete" ON public.iperc_consecuencias;
CREATE POLICY "iperc_consecuencias_delete" ON public.iperc_consecuencias AS PERMISSIVE FOR DELETE TO authenticated
  USING (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_consecuencias_insert" ON public.iperc_consecuencias;
CREATE POLICY "iperc_consecuencias_insert" ON public.iperc_consecuencias AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_consecuencias_update" ON public.iperc_consecuencias;
CREATE POLICY "iperc_consecuencias_update" ON public.iperc_consecuencias AS PERMISSIVE FOR UPDATE TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_niveles_riesgo_delete" ON public.iperc_niveles_riesgo;
CREATE POLICY "iperc_niveles_riesgo_delete" ON public.iperc_niveles_riesgo AS PERMISSIVE FOR DELETE TO authenticated
  USING (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_niveles_riesgo_insert" ON public.iperc_niveles_riesgo;
CREATE POLICY "iperc_niveles_riesgo_insert" ON public.iperc_niveles_riesgo AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_niveles_riesgo_update" ON public.iperc_niveles_riesgo;
CREATE POLICY "iperc_niveles_riesgo_update" ON public.iperc_niveles_riesgo AS PERMISSIVE FOR UPDATE TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_peligros_library_delete" ON public.iperc_peligros_library;
CREATE POLICY "iperc_peligros_library_delete" ON public.iperc_peligros_library AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "iperc_peligros_library_insert" ON public.iperc_peligros_library;
CREATE POLICY "iperc_peligros_library_insert" ON public.iperc_peligros_library AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "iperc_peligros_library_update" ON public.iperc_peligros_library;
CREATE POLICY "iperc_peligros_library_update" ON public.iperc_peligros_library AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "iperc_probabilidades_delete" ON public.iperc_probabilidades;
CREATE POLICY "iperc_probabilidades_delete" ON public.iperc_probabilidades AS PERMISSIVE FOR DELETE TO authenticated
  USING (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_probabilidades_insert" ON public.iperc_probabilidades;
CREATE POLICY "iperc_probabilidades_insert" ON public.iperc_probabilidades AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_probabilidades_update" ON public.iperc_probabilidades;
CREATE POLICY "iperc_probabilidades_update" ON public.iperc_probabilidades AS PERMISSIVE FOR UPDATE TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "iperc_riesgos_library_delete" ON public.iperc_riesgos_library;
CREATE POLICY "iperc_riesgos_library_delete" ON public.iperc_riesgos_library AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "iperc_riesgos_library_insert" ON public.iperc_riesgos_library;
CREATE POLICY "iperc_riesgos_library_insert" ON public.iperc_riesgos_library AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "iperc_riesgos_library_update" ON public.iperc_riesgos_library;
CREATE POLICY "iperc_riesgos_library_update" ON public.iperc_riesgos_library AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "medidas_control_delete" ON public.medidas_control;
CREATE POLICY "medidas_control_delete" ON public.medidas_control AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
END);

DROP POLICY IF EXISTS "medidas_control_insert" ON public.medidas_control;
CREATE POLICY "medidas_control_insert" ON public.medidas_control AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
END);

DROP POLICY IF EXISTS "medidas_control_update" ON public.medidas_control;
CREATE POLICY "medidas_control_update" ON public.medidas_control AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
END);

DROP POLICY IF EXISTS "normativa_categorias: delete" ON public.normativa_categorias;
CREATE POLICY "normativa_categorias: delete" ON public.normativa_categorias AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE is_active_member_of(consultora_id)
END);

DROP POLICY IF EXISTS "normativa_categorias: insert" ON public.normativa_categorias;
CREATE POLICY "normativa_categorias: insert" ON public.normativa_categorias AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE is_active_member_of(consultora_id)
END);

DROP POLICY IF EXISTS "normativa_categorias: update" ON public.normativa_categorias;
CREATE POLICY "normativa_categorias: update" ON public.normativa_categorias AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE is_active_member_of(consultora_id)
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE is_active_member_of(consultora_id)
END);

DROP POLICY IF EXISTS "normativa_normas: delete" ON public.normativa_normas;
CREATE POLICY "normativa_normas: delete" ON public.normativa_normas AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE is_active_member_of(consultora_id)
END);

DROP POLICY IF EXISTS "normativa_normas: insert" ON public.normativa_normas;
CREATE POLICY "normativa_normas: insert" ON public.normativa_normas AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE is_active_member_of(consultora_id)
END);

DROP POLICY IF EXISTS "normativa_normas: update" ON public.normativa_normas;
CREATE POLICY "normativa_normas: update" ON public.normativa_normas AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE is_active_member_of(consultora_id)
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE is_active_member_of(consultora_id)
END);

DROP POLICY IF EXISTS "nnte_write" ON public.normativa_normas_tipos_establecimiento;
CREATE POLICY "nnte_write" ON public.normativa_normas_tipos_establecimiento AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM normativa_normas n
  WHERE ((n.id = normativa_normas_tipos_establecimiento.norma_id) AND (((n.consultora_id IS NULL) AND puede_gestionar_librerias()) OR ((n.consultora_id IS NOT NULL) AND is_active_member_of(n.consultora_id)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM normativa_normas n
  WHERE ((n.id = normativa_normas_tipos_establecimiento.norma_id) AND (((n.consultora_id IS NULL) AND puede_gestionar_librerias()) OR ((n.consultora_id IS NOT NULL) AND is_active_member_of(n.consultora_id)))))));

DROP POLICY IF EXISTS "normativa_requisitos: delete" ON public.normativa_requisitos;
CREATE POLICY "normativa_requisitos: delete" ON public.normativa_requisitos AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM normativa_normas n
  WHERE ((n.id = normativa_requisitos.norma_id) AND
        CASE
            WHEN (n.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE is_active_member_of(n.consultora_id)
        END))));

DROP POLICY IF EXISTS "normativa_requisitos: insert" ON public.normativa_requisitos;
CREATE POLICY "normativa_requisitos: insert" ON public.normativa_requisitos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM normativa_normas n
  WHERE ((n.id = normativa_requisitos.norma_id) AND
        CASE
            WHEN (n.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE is_active_member_of(n.consultora_id)
        END))));

DROP POLICY IF EXISTS "normativa_requisitos: update" ON public.normativa_requisitos;
CREATE POLICY "normativa_requisitos: update" ON public.normativa_requisitos AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM normativa_normas n
  WHERE ((n.id = normativa_requisitos.norma_id) AND
        CASE
            WHEN (n.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE is_active_member_of(n.consultora_id)
        END))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM normativa_normas n
  WHERE ((n.id = normativa_requisitos.norma_id) AND
        CASE
            WHEN (n.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE is_active_member_of(n.consultora_id)
        END))));

DROP POLICY IF EXISTS "producto_assets: write" ON public.producto_assets;
CREATE POLICY "producto_assets: write" ON public.producto_assets AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM productos p
  WHERE ((p.id = producto_assets.producto_id) AND
        CASE
            WHEN (p.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE (p.consultora_id IN ( SELECT consultoras_members.consultora_id
               FROM consultoras_members
              WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
        END))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM productos p
  WHERE ((p.id = producto_assets.producto_id) AND
        CASE
            WHEN (p.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE (p.consultora_id IN ( SELECT consultoras_members.consultora_id
               FROM consultoras_members
              WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
        END))));

DROP POLICY IF EXISTS "producto_categoria_map: write" ON public.producto_categoria_map;
CREATE POLICY "producto_categoria_map: write" ON public.producto_categoria_map AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM productos p
  WHERE ((p.id = producto_categoria_map.producto_id) AND
        CASE
            WHEN (p.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE (p.consultora_id IN ( SELECT consultoras_members.consultora_id
               FROM consultoras_members
              WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
        END))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM productos p
  WHERE ((p.id = producto_categoria_map.producto_id) AND
        CASE
            WHEN (p.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE (p.consultora_id IN ( SELECT consultoras_members.consultora_id
               FROM consultoras_members
              WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
        END))));

DROP POLICY IF EXISTS "producto_variantes: write" ON public.producto_variantes;
CREATE POLICY "producto_variantes: write" ON public.producto_variantes AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM productos p
  WHERE ((p.id = producto_variantes.producto_id) AND
        CASE
            WHEN (p.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE (p.consultora_id IN ( SELECT consultoras_members.consultora_id
               FROM consultoras_members
              WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
        END))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM productos p
  WHERE ((p.id = producto_variantes.producto_id) AND
        CASE
            WHEN (p.consultora_id IS NULL) THEN puede_gestionar_librerias()
            ELSE (p.consultora_id IN ( SELECT consultoras_members.consultora_id
               FROM consultoras_members
              WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
        END))));

DROP POLICY IF EXISTS "productos: delete" ON public.productos;
CREATE POLICY "productos: delete" ON public.productos AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos: insert" ON public.productos;
CREATE POLICY "productos: insert" ON public.productos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
END);

DROP POLICY IF EXISTS "productos: update" ON public.productos;
CREATE POLICY "productos: update" ON public.productos AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_categorias: delete" ON public.productos_categorias;
CREATE POLICY "productos_categorias: delete" ON public.productos_categorias AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_categorias: insert" ON public.productos_categorias;
CREATE POLICY "productos_categorias: insert" ON public.productos_categorias AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_categorias: update" ON public.productos_categorias;
CREATE POLICY "productos_categorias: update" ON public.productos_categorias AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_clases: delete" ON public.productos_clases;
CREATE POLICY "productos_clases: delete" ON public.productos_clases AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_clases: insert" ON public.productos_clases;
CREATE POLICY "productos_clases: insert" ON public.productos_clases AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_clases: update" ON public.productos_clases;
CREATE POLICY "productos_clases: update" ON public.productos_clases AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_componentes: delete" ON public.productos_componentes;
CREATE POLICY "productos_componentes: delete" ON public.productos_componentes AS PERMISSIVE FOR DELETE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_componentes: insert" ON public.productos_componentes;
CREATE POLICY "productos_componentes: insert" ON public.productos_componentes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "productos_componentes: update" ON public.productos_componentes;
CREATE POLICY "productos_componentes: update" ON public.productos_componentes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END)
  WITH CHECK (
CASE
    WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id
       FROM consultoras_members
      WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
END);

DROP POLICY IF EXISTS "sap_sustancias_peligrosas: write" ON public.sap_sustancias_peligrosas;
CREATE POLICY "sap_sustancias_peligrosas: write" ON public.sap_sustancias_peligrosas AS PERMISSIVE FOR ALL TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "sap_tipos_documento: write" ON public.sap_tipos_documento;
CREATE POLICY "sap_tipos_documento: write" ON public.sap_tipos_documento AS PERMISSIVE FOR ALL TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "sap_tipos_medio_tecnico: write" ON public.sap_tipos_medio_tecnico;
CREATE POLICY "sap_tipos_medio_tecnico: write" ON public.sap_tipos_medio_tecnico AS PERMISSIVE FOR ALL TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "sap_tipos_rol: write" ON public.sap_tipos_rol;
CREATE POLICY "sap_tipos_rol: write" ON public.sap_tipos_rol AS PERMISSIVE FOR ALL TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

DROP POLICY IF EXISTS "sap_usos: write" ON public.sap_usos;
CREATE POLICY "sap_usos: write" ON public.sap_usos AS PERMISSIVE FOR ALL TO authenticated
  USING (puede_gestionar_librerias())
  WITH CHECK (puede_gestionar_librerias());

COMMIT;