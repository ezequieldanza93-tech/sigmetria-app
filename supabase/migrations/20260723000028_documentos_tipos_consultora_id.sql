-- ============================================================
-- documentos_tipos: base/propio (consultora_id) para documentos custom
-- ============================================================
-- Permite que una consultora agregue tipos de documento PROPIOS al catálogo,
-- que no existen en el catálogo global. NULL = documento global (Sigmetría);
-- consultora_id seteado = documento propio de esa consultora.
--
-- Como las tablas de subida (empresas/establecimientos/personas_documentos)
-- referencian documentos_tipos(id) por FK, los docs custom acá SÍ se pueden
-- subir y vencer como cualquier otro (a diferencia de una tabla separada).
--
-- RLS espeja EXACTAMENTE el patrón base/propio ya probado en `productos`:
--   SELECT: globales (NULL) los ve cualquiera; propios solo miembros activos.
--   INSERT/UPDATE/DELETE: globales solo staff (puede_gestionar_librerias);
--     propios, miembros de la consultora con rol de gestión.
--
-- NOTA: se conserva UNIQUE(nombre) global → por ahora el nombre de un doc custom
-- no puede repetir uno ya existente (global u otra consultora). Suficiente para
-- la etapa actual; si se necesita multi-tenant pleno, pasar a UNIQUE parcial.
-- ============================================================

ALTER TABLE public.documentos_tipos
  ADD COLUMN IF NOT EXISTS consultora_id uuid REFERENCES public.consultoras(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documentos_tipos_consultora ON public.documentos_tipos(consultora_id);

COMMENT ON COLUMN public.documentos_tipos.consultora_id IS
  'NULL = documento global (Sigmetría); seteado = documento propio de la consultora (custom).';

-- ─── RLS base/propio (espejo de productos) ───
DROP POLICY IF EXISTS "documentos_tipos: select" ON public.documentos_tipos;
CREATE POLICY "documentos_tipos: select" ON public.documentos_tipos
  FOR SELECT USING (
    consultora_id IS NULL OR public.is_active_member_of(consultora_id)
  );

DROP POLICY IF EXISTS "documentos_tipos: insert" ON public.documentos_tipos;
CREATE POLICY "documentos_tipos: insert" ON public.documentos_tipos
  FOR INSERT WITH CHECK (
    CASE
      WHEN consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])
      )
    END
  );

DROP POLICY IF EXISTS "documentos_tipos: update" ON public.documentos_tipos;
CREATE POLICY "documentos_tipos: update" ON public.documentos_tipos
  FOR UPDATE USING (
    CASE
      WHEN consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])
      )
    END
  ) WITH CHECK (
    CASE
      WHEN consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])
      )
    END
  );

DROP POLICY IF EXISTS "documentos_tipos: delete" ON public.documentos_tipos;
CREATE POLICY "documentos_tipos: delete" ON public.documentos_tipos
  FOR DELETE USING (
    CASE
      WHEN consultora_id IS NULL THEN public.puede_gestionar_librerias()
      ELSE consultora_id IN (
        SELECT cm.consultora_id FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
          AND cm.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])
      )
    END
  );
