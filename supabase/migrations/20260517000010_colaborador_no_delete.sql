-- ============================================================
-- colaborador_no_delete: Prevent colaboradores from deleting records.
--
-- Adds two admin-only helper functions (exclude colaborador branch)
-- and replaces ALL DELETE policies that used the write_access helpers
-- (which include colaborador) with admin-only versions.
-- ============================================================

-- 1. Admin-only empresa access — like has_empresa_write_access but NO colaborador branch
CREATE OR REPLACE FUNCTION public.has_empresa_admin_access(p_empresa_id uuid)
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
$$;

-- 2. Admin-only establecimiento access — like has_establecimiento_write_access but NO colaborador branches
CREATE OR REPLACE FUNCTION public.has_establecimiento_admin_access(p_establecimiento_id uuid)
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
$$;

-- ============================================================
-- DROP + recreate every DELETE policy that used write_access
-- (write_access includes colaborador; admin_access does not)
-- ============================================================

-- empresas
DROP POLICY IF EXISTS "empresas: delete" ON public.empresas;
CREATE POLICY "empresas: delete" ON public.empresas FOR DELETE
  USING (has_empresa_admin_access(id));

-- establecimientos
DROP POLICY IF EXISTS "establecimientos: delete" ON public.establecimientos;
CREATE POLICY "establecimientos: delete" ON public.establecimientos FOR DELETE
  USING (has_establecimiento_admin_access(id));

-- siniestros
DROP POLICY IF EXISTS "siniestros: delete" ON public.siniestros;
CREATE POLICY "siniestros: delete" ON public.siniestros FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- inspecciones
DROP POLICY IF EXISTS "inspecciones: delete" ON public.inspecciones;
CREATE POLICY "inspecciones: delete" ON public.inspecciones FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- capacitaciones
DROP POLICY IF EXISTS "capacitaciones: delete" ON public.capacitaciones;
CREATE POLICY "capacitaciones: delete" ON public.capacitaciones FOR DELETE
  USING (has_empresa_admin_access(empresa_id));

-- capacitacion_asistentes
DROP POLICY IF EXISTS "capacitacion_asistentes: delete" ON public.capacitacion_asistentes;
CREATE POLICY "capacitacion_asistentes: delete" ON public.capacitacion_asistentes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.capacitaciones c
      WHERE c.id = capacitacion_id AND has_empresa_admin_access(c.empresa_id)
    )
  );

-- riesgos
DROP POLICY IF EXISTS "riesgos: delete" ON public.riesgos;
CREATE POLICY "riesgos: delete" ON public.riesgos FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- mediciones
DROP POLICY IF EXISTS "mediciones: delete" ON public.mediciones;
CREATE POLICY "mediciones: delete" ON public.mediciones FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- sectores_establecimiento
DROP POLICY IF EXISTS "sectores: delete" ON public.sectores_establecimiento;
CREATE POLICY "sectores: delete" ON public.sectores_establecimiento FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- puestos_de_trabajo
DROP POLICY IF EXISTS "puestos: delete" ON public.puestos_de_trabajo;
CREATE POLICY "puestos: delete" ON public.puestos_de_trabajo FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_admin_access(se.establecimiento_id)
    )
  );

-- empleado_puesto
DROP POLICY IF EXISTS "empleado_puesto: delete" ON public.empleado_puesto;
CREATE POLICY "empleado_puesto: delete" ON public.empleado_puesto FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_admin_access(se.establecimiento_id)
    )
  );

-- empresa_documentos
DROP POLICY IF EXISTS "empresa_documentos: delete" ON public.empresa_documentos;
CREATE POLICY "empresa_documentos: delete" ON public.empresa_documentos FOR DELETE
  USING (has_empresa_admin_access(empresa_id));

-- establecimiento_documentos
DROP POLICY IF EXISTS "establecimiento_documentos: delete" ON public.establecimiento_documentos;
CREATE POLICY "establecimiento_documentos: delete" ON public.establecimiento_documentos FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- empleado_documentos (latest form: acceso via empleado_puesto usando persona_id)
DROP POLICY IF EXISTS "empleado_documentos: delete" ON public.empleado_documentos;
CREATE POLICY "empleado_documentos: delete" ON public.empleado_documentos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = empleado_documentos.persona_id
        AND has_establecimiento_admin_access(se.establecimiento_id)
    )
  );

-- organizacion_establecimiento
DROP POLICY IF EXISTS "organizacion_establecimiento: delete" ON public.organizacion_establecimiento;
CREATE POLICY "organizacion_establecimiento: delete" ON public.organizacion_establecimiento FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- persona_establecimiento
DROP POLICY IF EXISTS "persona_establecimiento: delete" ON public.persona_establecimiento;
CREATE POLICY "persona_establecimiento: delete" ON public.persona_establecimiento FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- directorio_personas (acceso derivado via persona_establecimiento o empleado_puesto)
DROP POLICY IF EXISTS "directorio_personas: delete" ON public.directorio_personas;
CREATE POLICY "directorio_personas: delete" ON public.directorio_personas FOR DELETE
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.persona_establecimiento pe
      WHERE pe.persona_id = directorio_personas.id
        AND has_establecimiento_admin_access(pe.establecimiento_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = directorio_personas.id
        AND has_establecimiento_admin_access(se.establecimiento_id)
    )
  );

-- asistencia_diaria
DROP POLICY IF EXISTS "asistencia_diaria: delete" ON public.asistencia_diaria;
CREATE POLICY "asistencia_diaria: delete" ON public.asistencia_diaria FOR DELETE
  USING (has_establecimiento_admin_access(establecimiento_id));

-- epp_por_puesto
DROP POLICY IF EXISTS "epp_por_puesto: delete" ON public.epp_por_puesto;
CREATE POLICY "epp_por_puesto: delete" ON public.epp_por_puesto FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_admin_access(se.establecimiento_id)
    )
  );

-- gestion_establecimiento
DROP POLICY IF EXISTS "gestion_establecimiento: delete" ON public.gestion_establecimiento;
CREATE POLICY "gestion_establecimiento: delete" ON public.gestion_establecimiento
  FOR DELETE TO authenticated
  USING (has_establecimiento_admin_access(establecimiento_id));

-- registro_gestiones
DROP POLICY IF EXISTS "registro_gestiones: delete" ON public.registro_gestiones;
CREATE POLICY "registro_gestiones: delete" ON public.registro_gestiones
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestion_establecimiento ge
      WHERE ge.id = registro_gestiones.gestion_establecimiento_id
        AND has_establecimiento_admin_access(ge.establecimiento_id)
    )
  );

-- observaciones_gestiones
DROP POLICY IF EXISTS "observaciones_gestiones: delete" ON public.observaciones_gestiones;
CREATE POLICY "observaciones_gestiones: delete" ON public.observaciones_gestiones
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registro_gestiones rg
      JOIN public.gestion_establecimiento ge ON ge.id = rg.gestion_establecimiento_id
      WHERE rg.id = observaciones_gestiones.registro_gestion_id
        AND has_establecimiento_admin_access(ge.establecimiento_id)
    )
  );
