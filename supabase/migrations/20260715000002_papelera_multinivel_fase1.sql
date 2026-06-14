-- ============================================================
-- Papelera multinivel (Fase 1) — soft-delete de la jerarquía estructural
-- ============================================================
-- Empresa → Establecimiento → Sector → Puesto pasan a soportar "papelera":
-- el admin principal (full_access_main) puede SACARLOS de la UI sin perder los
-- datos (cumplimiento Disp. 15/2026: la cadena de custodia en audit_log queda
-- intacta y las filas no se borran físicamente).
--
-- Decisión del dueño (2026-06-13):
--   - Borrado = soft (deleted_at). El dato se OCULTA, no se borra físico.
--   - A los 90 días saldrá de la papelera y dejará de ser restaurable (Fase 2,
--     vía un purgado_at; NO hay DELETE físico). Esta migración es solo Fase 1.
--   - Inactivar (is_active / status) es OTRA cosa: sigue visible. No se toca acá.
--
-- Estrategia RLS (IMPORTANTE — seguridad multi-tenant):
--   NO reescribimos las policies SELECT permisivas de estas tablas core (su
--   predicado de acceso por consultora es sensible y pudo evolucionar en
--   migraciones posteriores; reescribirlo mal expondría/bloquearía datos entre
--   consultoras). En su lugar agregamos una policy RESTRICTIVE aditiva que se
--   combina con AND sobre las permisivas existentes y oculta lo borrado a todos
--   los roles autenticados (developer sí ve la papelera). El service_role
--   (admin client) bypassa RLS → la vista de papelera lee con admin client +
--   gating manual de full_access_main en la server action.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP POLICY IF EXISTS + CREATE.
-- ============================================================

-- ─── 1. Columnas de papelera ────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['empresas', 'establecimientos', 'establecimientos_sectores', 'puestos_de_trabajo']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz;', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_reason text;', t);
    EXECUTE format($f$COMMENT ON COLUMN public.%I.deleted_at IS 'Papelera (soft-delete). NULL = vigente. No se borra físico (Disp. 15/2026). Restaurable hasta 90 días.';$f$, t);
  END LOOP;
END $$;

-- ─── 2. Índices parciales (listados de vigentes) ────────────
CREATE INDEX IF NOT EXISTS idx_empresas_vigentes
  ON public.empresas (consultora_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_establecimientos_vigentes
  ON public.establecimientos (empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_establecimientos_sectores_vigentes
  ON public.establecimientos_sectores (establecimiento_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_puestos_de_trabajo_vigentes
  ON public.puestos_de_trabajo (sector_id) WHERE deleted_at IS NULL;

-- Índice para la vista de papelera (filtrar borrados por fecha).
CREATE INDEX IF NOT EXISTS idx_empresas_papelera
  ON public.empresas (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_establecimientos_papelera
  ON public.establecimientos (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_establecimientos_sectores_papelera
  ON public.establecimientos_sectores (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_puestos_de_trabajo_papelera
  ON public.puestos_de_trabajo (deleted_at) WHERE deleted_at IS NOT NULL;

-- ─── 3. RESTRICTIVE "hide trashed" en SELECT ────────────────
-- Se combina con AND sobre las policies permisivas existentes. Oculta los
-- borrados a todos los roles autenticados; el `OR is_developer()` EXCEPTÚA al
-- super admin (is_developer() == is_super_admin()), que sí ve la papelera por
-- RLS directo. El admin principal (full_access_main) la ve SOLO vía
-- listarPapelera() con admin client (service_role bypassa RLS).

DROP POLICY IF EXISTS "empresas: hide trashed" ON public.empresas;
CREATE POLICY "empresas: hide trashed" ON public.empresas
  AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "establecimientos: hide trashed" ON public.establecimientos;
CREATE POLICY "establecimientos: hide trashed" ON public.establecimientos
  AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "establecimientos_sectores: hide trashed" ON public.establecimientos_sectores;
CREATE POLICY "establecimientos_sectores: hide trashed" ON public.establecimientos_sectores
  AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "puestos_de_trabajo: hide trashed" ON public.puestos_de_trabajo;
CREATE POLICY "puestos_de_trabajo: hide trashed" ON public.puestos_de_trabajo
  AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR public.is_developer());

-- ─── 4. Proteger la promesa de soft-delete (Disp. 15/2026) ──
-- (a) RESTRICTIVE FOR DELETE → el borrado FÍSICO de estas tablas queda solo
-- para developer. Combina con AND sobre las permisivas de DELETE existentes
-- (sin depender de su nombre exacto), así garantizamos que un admin principal
-- NO pueda destruir físicamente una fila (perdería el dato de la papelera).
-- (b) RESTRICTIVE FOR UPDATE → no se puede editar una fila YA en papelera por
-- el camino RLS normal. Las server actions de papelera usan admin client
-- (service_role bypassa RLS), así que mover/restaurar/togglear NO se rompen.

DROP POLICY IF EXISTS "empresas: no hard delete" ON public.empresas;
CREATE POLICY "empresas: no hard delete" ON public.empresas
  AS RESTRICTIVE FOR DELETE USING (public.is_developer());
DROP POLICY IF EXISTS "empresas: no edit trashed" ON public.empresas;
CREATE POLICY "empresas: no edit trashed" ON public.empresas
  AS RESTRICTIVE FOR UPDATE
  USING (deleted_at IS NULL OR public.is_developer())
  WITH CHECK (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "establecimientos: no hard delete" ON public.establecimientos;
CREATE POLICY "establecimientos: no hard delete" ON public.establecimientos
  AS RESTRICTIVE FOR DELETE USING (public.is_developer());
DROP POLICY IF EXISTS "establecimientos: no edit trashed" ON public.establecimientos;
CREATE POLICY "establecimientos: no edit trashed" ON public.establecimientos
  AS RESTRICTIVE FOR UPDATE
  USING (deleted_at IS NULL OR public.is_developer())
  WITH CHECK (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "establecimientos_sectores: no hard delete" ON public.establecimientos_sectores;
CREATE POLICY "establecimientos_sectores: no hard delete" ON public.establecimientos_sectores
  AS RESTRICTIVE FOR DELETE USING (public.is_developer());
DROP POLICY IF EXISTS "establecimientos_sectores: no edit trashed" ON public.establecimientos_sectores;
CREATE POLICY "establecimientos_sectores: no edit trashed" ON public.establecimientos_sectores
  AS RESTRICTIVE FOR UPDATE
  USING (deleted_at IS NULL OR public.is_developer())
  WITH CHECK (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "puestos_de_trabajo: no hard delete" ON public.puestos_de_trabajo;
CREATE POLICY "puestos_de_trabajo: no hard delete" ON public.puestos_de_trabajo
  AS RESTRICTIVE FOR DELETE USING (public.is_developer());
DROP POLICY IF EXISTS "puestos_de_trabajo: no edit trashed" ON public.puestos_de_trabajo;
CREATE POLICY "puestos_de_trabajo: no edit trashed" ON public.puestos_de_trabajo
  AS RESTRICTIVE FOR UPDATE
  USING (deleted_at IS NULL OR public.is_developer())
  WITH CHECK (deleted_at IS NULL OR public.is_developer());

-- ============================================================
-- NOTA Fase 2 (pendiente): cron de aviso 72hs antes de los 90 días +
-- columna/flag purgado_at que saca el registro de la papelera (no-restaurable),
-- SIN borrado físico. Las server actions de mover/restaurar/listar/contar usan
-- admin client + gating full_access_main (lib/actions/papelera.ts).
-- ============================================================
