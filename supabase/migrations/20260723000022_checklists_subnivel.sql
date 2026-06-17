-- ============================================================
-- Checklists: sub-nivel "categorías checklist" (4to nivel)
-- ============================================================
-- Reporte 24880786. "Checklists" deja de ser GRUPO y pasa a ser CATEGORÍA
-- dentro del grupo "Controles Operativos". Sus 13 categorías actuales (99
-- checklists) pasan a un sub-nivel NUEVO "categorías checklist". Único caso
-- con 4 niveles: grupo -> categoría -> categoría checklist -> gestión.
--
-- Idempotente: CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP POLICY
-- IF EXISTS, ON CONFLICT en el seed, y el DO block es re-ejecutable.
-- RLS espejada de gestiones_categorias (híbrida: base = puede_gestionar_librerias;
-- propias = full_access).
-- ============================================================

BEGIN;

-- ─── 1. Tabla del sub-nivel ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gestiones_checklist_categorias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id  uuid NOT NULL REFERENCES public.gestiones_categorias(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  descripcion   text,
  consultora_id uuid REFERENCES public.consultoras(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (nombre, categoria_id, consultora_id)
);
CREATE INDEX IF NOT EXISTS idx_gcc_categoria ON public.gestiones_checklist_categorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_gcc_consultora ON public.gestiones_checklist_categorias(consultora_id) WHERE consultora_id IS NOT NULL;

COMMENT ON TABLE public.gestiones_checklist_categorias IS
  'Sub-nivel exclusivo de los checklists (4to nivel): agrupa los checklists dentro de la categoría Checklists. categoria_id apunta a la categoría Checklists.';

-- ─── 2. FK en gestiones ─────────────────────────────────────
ALTER TABLE public.gestiones
  ADD COLUMN IF NOT EXISTS checklist_categoria_id uuid
  REFERENCES public.gestiones_checklist_categorias(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gestiones_checklist_cat
  ON public.gestiones(checklist_categoria_id) WHERE checklist_categoria_id IS NOT NULL;

-- ─── 3. RLS (espejo de gestiones_categorias) ────────────────
ALTER TABLE public.gestiones_checklist_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gestiones_checklist_categorias: select" ON public.gestiones_checklist_categorias;
CREATE POLICY "gestiones_checklist_categorias: select" ON public.gestiones_checklist_categorias
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((consultora_id IS NULL) OR is_active_member_of(consultora_id));

DROP POLICY IF EXISTS "gestiones_checklist_categorias: insert" ON public.gestiones_checklist_categorias;
CREATE POLICY "gestiones_checklist_categorias: insert" ON public.gestiones_checklist_categorias
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id FROM consultoras_members
       WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
    END
  );

DROP POLICY IF EXISTS "gestiones_checklist_categorias: update" ON public.gestiones_checklist_categorias;
CREATE POLICY "gestiones_checklist_categorias: update" ON public.gestiones_checklist_categorias
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    CASE WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id FROM consultoras_members
       WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
    END
  );

DROP POLICY IF EXISTS "gestiones_checklist_categorias: delete" ON public.gestiones_checklist_categorias;
CREATE POLICY "gestiones_checklist_categorias: delete" ON public.gestiones_checklist_categorias
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    CASE WHEN (consultora_id IS NULL) THEN puede_gestionar_librerias()
    ELSE (consultora_id IN ( SELECT consultoras_members.consultora_id FROM consultoras_members
       WHERE ((consultoras_members.user_id = auth.uid()) AND (consultoras_members.is_active = true) AND (consultoras_members.role = ANY (ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])))))
    END
  );

-- ─── 4. Migración de datos ──────────────────────────────────
DO $mig$
DECLARE
  v_co_grupo  uuid := '4f4fb2ee-4100-4d30-82f1-e6c4365d5694'; -- Controles Operativos
  v_chk_grupo uuid := '66635b12-ce90-4991-9fb9-f4aebe307652'; -- Checklists (grupo viejo)
  v_chk_cat   uuid;
  v_sub       uuid;
  r           record;
BEGIN
  -- Solo migrar si el grupo viejo todavía existe (re-ejecutable)
  IF NOT EXISTS (SELECT 1 FROM public.gestiones_grupos WHERE id = v_chk_grupo) THEN
    RETURN;
  END IF;

  -- Categoría "Checklists" bajo Controles Operativos (base)
  SELECT id INTO v_chk_cat FROM public.gestiones_categorias
    WHERE grupo_id = v_co_grupo AND nombre = 'Checklists' AND consultora_id IS NULL;
  IF v_chk_cat IS NULL THEN
    INSERT INTO public.gestiones_categorias (nombre, grupo_id, consultora_id)
      VALUES ('Checklists', v_co_grupo, NULL) RETURNING id INTO v_chk_cat;
  END IF;

  -- Cada categoría vieja del grupo Checklists -> sub-nivel + re-parentear gestiones
  FOR r IN SELECT id, nombre, descripcion FROM public.gestiones_categorias WHERE grupo_id = v_chk_grupo LOOP
    INSERT INTO public.gestiones_checklist_categorias (categoria_id, nombre, descripcion, consultora_id)
      VALUES (v_chk_cat, r.nombre, r.descripcion, NULL)
      ON CONFLICT (nombre, categoria_id, consultora_id) DO UPDATE SET descripcion = EXCLUDED.descripcion
      RETURNING id INTO v_sub;
    UPDATE public.gestiones
      SET categoria_id = v_chk_cat, checklist_categoria_id = v_sub
      WHERE categoria_id = r.id;
  END LOOP;

  -- Borrar las categorías viejas (ya sin gestiones) y el grupo viejo
  DELETE FROM public.gestiones_categorias WHERE grupo_id = v_chk_grupo;
  DELETE FROM public.gestiones_grupos WHERE id = v_chk_grupo;
END $mig$;

COMMIT;
