-- ============================================================
-- Sigmetría HyS — Fix RLS permisiva en tablas de formularios
-- Issue #2: auth.uid() IS NOT NULL → políticas por establecimiento
--
-- Tablas corregidas:
--   - formulario_respuestas (tiene establecimiento_id directo)
--   - formulario_item_respuestas (hereda vía FK)
--   - subcontratista_respuestas (vía subcontratistas → org → estab)
--
-- Tablas NO modificadas (catálogos, riesgo bajo):
--   - formulario_secciones, formulario_items: son catálogos de
--     definición, no contienen datos de establecimientos.
--   - formulario_seccion_aspectos, aspectos: catálogos puros.
--   - categorias_formularios: eliminada (20260519000001).
--
-- ROLLBACK:
--   git checkout HEAD~1 -- supabase/migrations/[nombre].sql
--   (drop + recreate las policies viejas desde 20260518000015)
-- ============================================================

-- ============================================================
-- formulario_respuestas: policies por establecimiento
-- ============================================================

DROP POLICY IF EXISTS "formulario_respuestas: select" ON public.formulario_respuestas;
CREATE POLICY "formulario_respuestas: select"
  ON public.formulario_respuestas FOR SELECT TO authenticated
  USING (has_establecimiento_read_access(establecimiento_id));

DROP POLICY IF EXISTS "formulario_respuestas: insert" ON public.formulario_respuestas;
CREATE POLICY "formulario_respuestas: insert"
  ON public.formulario_respuestas FOR INSERT TO authenticated
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "formulario_respuestas: update" ON public.formulario_respuestas;
CREATE POLICY "formulario_respuestas: update"
  ON public.formulario_respuestas FOR UPDATE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));

-- DELETE: solo developer (misma semántica que antes)


-- ============================================================
-- formulario_item_respuestas: policies vía respuesta padre
-- ============================================================

DROP POLICY IF EXISTS "formulario_item_respuestas: select" ON public.formulario_item_respuestas;
CREATE POLICY "formulario_item_respuestas: select"
  ON public.formulario_item_respuestas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.formulario_respuestas fr
      WHERE fr.id = formulario_item_respuestas.respuesta_id
        AND has_establecimiento_read_access(fr.establecimiento_id)
    )
  );

DROP POLICY IF EXISTS "formulario_item_respuestas: insert" ON public.formulario_item_respuestas;
CREATE POLICY "formulario_item_respuestas: insert"
  ON public.formulario_item_respuestas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.formulario_respuestas fr
      WHERE fr.id = respuesta_id
        AND has_establecimiento_write_access(fr.establecimiento_id)
    )
  );

DROP POLICY IF EXISTS "formulario_item_respuestas: update" ON public.formulario_item_respuestas;
CREATE POLICY "formulario_item_respuestas: update"
  ON public.formulario_item_respuestas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.formulario_respuestas fr
      WHERE fr.id = formulario_item_respuestas.respuesta_id
        AND has_establecimiento_write_access(fr.establecimiento_id)
    )
  );

-- DELETE: solo developer (misma semántica)


-- ============================================================
-- subcontratista_respuestas: policies con scope real
-- ============================================================
-- Antes: FOR ALL TO authenticated USING (auth.uid() IS NOT NULL)
-- Después: SELECT via read_access, INSERT/UPDATE/DELETE via write_access

DROP POLICY IF EXISTS "subcontratista_respuestas: all" ON public.subcontratista_respuestas;

CREATE POLICY "subcontratista_respuestas: select"
  ON public.subcontratista_respuestas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizacion_establecimiento oe
        ON oe.organizacion_id = s.organizacion_id
      WHERE s.id = subcontratista_respuestas.subcontratista_id
        AND has_establecimiento_read_access(oe.establecimiento_id)
    )
  );

CREATE POLICY "subcontratista_respuestas: insert"
  ON public.subcontratista_respuestas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizacion_establecimiento oe
        ON oe.organizacion_id = s.organizacion_id
      WHERE s.id = subcontratista_respuestas.subcontratista_id
        AND has_establecimiento_write_access(oe.establecimiento_id)
    )
  );

CREATE POLICY "subcontratista_respuestas: update"
  ON public.subcontratista_respuestas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizacion_establecimiento oe
        ON oe.organizacion_id = s.organizacion_id
      WHERE s.id = subcontratista_respuestas.subcontratista_id
        AND has_establecimiento_write_access(oe.establecimiento_id)
    )
  );

CREATE POLICY "subcontratista_respuestas: delete"
  ON public.subcontratista_respuestas FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizacion_establecimiento oe
        ON oe.organizacion_id = s.organizacion_id
      WHERE s.id = subcontratista_respuestas.subcontratista_id
        AND has_establecimiento_write_access(oe.establecimiento_id)
    )
  );
