-- d9ec5ced: permitir que las consultoras editen los ÍTEMS y SECCIONES de SUS
-- checklists propios (gestiones con consultora_id = su consultora). Los checklists
-- base (gestion.consultora_id IS NULL) siguen restringidos a quien gestiona la
-- librería base (puede_gestionar_librerias()). SELECT queda abierto a autenticados.
--
-- Patrón idéntico al de la tabla `gestiones` (CASE base vs propia), pero acá el
-- vínculo a la consultora se deriva por JOIN a la gestión dueña:
--   formularios_secciones.gestion_id -> gestiones.consultora_id
--   formularios_items.section_id -> formularios_secciones.gestion_id -> gestiones.consultora_id

BEGIN;

-- ── formularios_secciones ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "formularios_secciones: insert" ON public.formularios_secciones;
CREATE POLICY "formularios_secciones: insert" ON public.formularios_secciones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.gestiones g
    WHERE g.id = gestion_id AND CASE
      WHEN g.consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE g.consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role]))
    END
  ));

DROP POLICY IF EXISTS "formularios_secciones: update" ON public.formularios_secciones;
CREATE POLICY "formularios_secciones: update" ON public.formularios_secciones FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gestiones g
    WHERE g.id = gestion_id AND CASE
      WHEN g.consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE g.consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role]))
    END
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.gestiones g
    WHERE g.id = gestion_id AND CASE
      WHEN g.consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE g.consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role]))
    END
  ));

DROP POLICY IF EXISTS "formularios_secciones: delete" ON public.formularios_secciones;
CREATE POLICY "formularios_secciones: delete" ON public.formularios_secciones FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gestiones g
    WHERE g.id = gestion_id AND CASE
      WHEN g.consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE g.consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role]))
    END
  ));

-- ── formularios_items (vínculo en 2 niveles: item -> seccion -> gestion) ─────
DROP POLICY IF EXISTS "formularios_items: insert" ON public.formularios_items;
CREATE POLICY "formularios_items: insert" ON public.formularios_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.formularios_secciones s
    JOIN public.gestiones g ON g.id = s.gestion_id
    WHERE s.id = section_id AND CASE
      WHEN g.consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE g.consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role]))
    END
  ));

DROP POLICY IF EXISTS "formularios_items: update" ON public.formularios_items;
CREATE POLICY "formularios_items: update" ON public.formularios_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.formularios_secciones s
    JOIN public.gestiones g ON g.id = s.gestion_id
    WHERE s.id = section_id AND CASE
      WHEN g.consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE g.consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role]))
    END
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.formularios_secciones s
    JOIN public.gestiones g ON g.id = s.gestion_id
    WHERE s.id = section_id AND CASE
      WHEN g.consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE g.consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role]))
    END
  ));

DROP POLICY IF EXISTS "formularios_items: delete" ON public.formularios_items;
CREATE POLICY "formularios_items: delete" ON public.formularios_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.formularios_secciones s
    JOIN public.gestiones g ON g.id = s.gestion_id
    WHERE s.id = section_id AND CASE
      WHEN g.consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE g.consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role]))
    END
  ));

COMMIT;
