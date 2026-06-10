-- ============================================================
-- Fix RLS denuncias: usar has_empresa_read_access(empresa_id)
--
-- La política original usaba has_establecimiento_read_access(establecimiento_id).
-- Si el usuario tiene acceso a nivel empresa (user_access.establecimiento_id IS NULL),
-- esa función puede evaluar a FALSE aunque el usuario SÍ tenga acceso.
-- El patrón probado en incidentes usa has_empresa_read_access(empresa_id).
-- ============================================================

DROP POLICY IF EXISTS "denuncias: select" ON public.denuncias;
CREATE POLICY "denuncias: select" ON public.denuncias FOR SELECT
  USING (has_empresa_read_access(empresa_id));

DROP POLICY IF EXISTS "denuncias: insert" ON public.denuncias;
CREATE POLICY "denuncias: insert" ON public.denuncias FOR INSERT
  WITH CHECK (has_empresa_write_access(empresa_id));

DROP POLICY IF EXISTS "denuncias: update" ON public.denuncias;
CREATE POLICY "denuncias: update" ON public.denuncias FOR UPDATE
  USING (has_empresa_write_access(empresa_id));

DROP POLICY IF EXISTS "denuncias: delete" ON public.denuncias;
CREATE POLICY "denuncias: delete" ON public.denuncias FOR DELETE
  USING (has_empresa_write_access(empresa_id));

-- denuncias_fotos: misma lógica
DROP POLICY IF EXISTS "denuncias_fotos: select" ON public.denuncias_fotos;
CREATE POLICY "denuncias_fotos: select" ON public.denuncias_fotos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_fotos.denuncia_id
      AND has_empresa_read_access(d.empresa_id)
  ));

DROP POLICY IF EXISTS "denuncias_fotos: insert" ON public.denuncias_fotos;
CREATE POLICY "denuncias_fotos: insert" ON public.denuncias_fotos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncia_id
      AND has_empresa_write_access(d.empresa_id)
  ));

DROP POLICY IF EXISTS "denuncias_fotos: delete" ON public.denuncias_fotos;
CREATE POLICY "denuncias_fotos: delete" ON public.denuncias_fotos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_fotos.denuncia_id
      AND has_empresa_write_access(d.empresa_id)
  ));

-- denuncias_historial: misma lógica
DROP POLICY IF EXISTS "denuncias_historial: select" ON public.denuncias_historial;
CREATE POLICY "denuncias_historial: select" ON public.denuncias_historial FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_historial.denuncia_id
      AND has_empresa_read_access(d.empresa_id)
  ));

DROP POLICY IF EXISTS "denuncias_historial: insert" ON public.denuncias_historial;
CREATE POLICY "denuncias_historial: insert" ON public.denuncias_historial FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncia_id
      AND has_empresa_write_access(d.empresa_id)
  ));
