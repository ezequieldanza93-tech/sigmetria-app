-- ============================================================
-- Papelera (soft-delete) para datos de COMPLIANCE
-- ============================================================
-- Por qué: los datos de Higiene y Seguridad (incidentes, inspecciones,
-- mediciones, riesgos, documentos, denuncias) son evidencia regulatoria. Un
-- DELETE físico es irreversible y peligroso ante auditorías. Pasamos a
-- soft-delete: las filas se marcan con deleted_at y desaparecen de los
-- listados (RLS), pero quedan recuperables.
--
-- Qué hace:
--   1. Agrega columna deleted_at (nullable) a las tablas de compliance.
--   2. Reescribe la policy de SELECT para filtrar deleted_at IS NULL
--      (super-admin/developer ven todo, incluida la papelera).
--   3. Restringe el DELETE físico a developer (el borrado normal es soft).
--   4. Índices parciales WHERE deleted_at IS NULL para los listados.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP POLICY IF EXISTS + CREATE.
--
-- Tablas cubiertas (entidades de datos, no catálogos/config):
--   incidentes (ex-siniestros), inspecciones, mediciones, riesgos,
--   establecimientos_denuncias, y las CUATRO tablas reales de documentos:
--   empresas_documentos, establecimientos_documentos, personas_documentos,
--   subcontratistas_documentos.
--
-- NOTA: no existe una tabla única `public.documentos` — los documentos viven
-- separados por entidad dueña. Por eso el bloque de documentos opera sobre las
-- cuatro tablas reales.
--
-- Para ocultar la papelera en las tablas de documentos usamos policies
-- RESTRICTIVE aditivas (se combinan con AND sobre las permisivas existentes) en
-- vez de reescribir cada SELECT. Motivo: personas_documentos y
-- subcontratistas_documentos tienen predicados de acceso complejos (dual-path /
-- EXISTS anidados) que es frágil reproducir; la restrictive evita tocarlos.
-- ============================================================

-- ─── 1. Columnas deleted_at ─────────────────────────────────
ALTER TABLE public.incidentes               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.inspecciones             ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.mediciones               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.riesgos                  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.establecimientos_denuncias ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
-- Documentos: cuatro tablas reales (no existe `public.documentos`).
ALTER TABLE public.empresas_documentos          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.establecimientos_documentos  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.personas_documentos          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.subcontratistas_documentos   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ─── 2. Índices parciales (listados de vigentes) ────────────
CREATE INDEX IF NOT EXISTS idx_incidentes_vigentes
  ON public.incidentes (establecimiento_id, fecha_ocurrencia DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inspecciones_vigentes
  ON public.inspecciones (establecimiento_id, fecha_programada DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mediciones_vigentes
  ON public.mediciones (establecimiento_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_riesgos_vigentes
  ON public.riesgos (establecimiento_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_estab_denuncias_vigentes
  ON public.establecimientos_denuncias (establecimiento_id, fecha DESC) WHERE deleted_at IS NULL;
-- Documentos: índice parcial por entidad dueña para los listados de vigentes.
CREATE INDEX IF NOT EXISTS idx_empresas_documentos_vigentes
  ON public.empresas_documentos (empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_establecimientos_documentos_vigentes
  ON public.establecimientos_documentos (establecimiento_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_personas_documentos_vigentes
  ON public.personas_documentos (persona_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subcontratistas_documentos_vigentes
  ON public.subcontratistas_documentos (subcontratista_id) WHERE deleted_at IS NULL;

-- ─── 3. Reescribir SELECT para ocultar la papelera ──────────
-- Patrón: USING (deleted_at IS NULL [OR is_developer()]) AND <acceso existente>.
-- Developer ve también la papelera para poder restaurar/auditar.

-- INCIDENTES (acceso por establecimiento)
DROP POLICY IF EXISTS "incidentes: select" ON public.incidentes;
CREATE POLICY "incidentes: select" ON public.incidentes FOR SELECT
  USING ((deleted_at IS NULL OR public.is_developer())
         AND public.has_establecimiento_read_access(establecimiento_id));

-- INSPECCIONES
DROP POLICY IF EXISTS "inspecciones: select" ON public.inspecciones;
CREATE POLICY "inspecciones: select" ON public.inspecciones FOR SELECT
  USING ((deleted_at IS NULL OR public.is_developer())
         AND public.has_establecimiento_read_access(establecimiento_id));

-- MEDICIONES
DROP POLICY IF EXISTS "mediciones: select" ON public.mediciones;
CREATE POLICY "mediciones: select" ON public.mediciones FOR SELECT
  USING ((deleted_at IS NULL OR public.is_developer())
         AND public.has_establecimiento_read_access(establecimiento_id));

-- RIESGOS
DROP POLICY IF EXISTS "riesgos: select" ON public.riesgos;
CREATE POLICY "riesgos: select" ON public.riesgos FOR SELECT
  USING ((deleted_at IS NULL OR public.is_developer())
         AND public.has_establecimiento_read_access(establecimiento_id));

-- DOCUMENTOS (4 tablas reales) — papelera vía policy RESTRICTIVE aditiva.
-- La restrictive se combina con AND sobre la policy permisiva de SELECT que ya
-- tiene cada tabla, así NO reescribimos sus predicados de acceso (algunos son
-- dual-path / EXISTS anidados, frágiles de reproducir). Efecto: el acceso queda
-- (acceso existente) AND (deleted_at IS NULL OR is_developer()).
-- Sin TO → aplica a todos los roles, garantizando que la papelera siempre se oculta.

DROP POLICY IF EXISTS "empresas_documentos: hide trashed" ON public.empresas_documentos;
CREATE POLICY "empresas_documentos: hide trashed" ON public.empresas_documentos
  AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "establecimientos_documentos: hide trashed" ON public.establecimientos_documentos;
CREATE POLICY "establecimientos_documentos: hide trashed" ON public.establecimientos_documentos
  AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "personas_documentos: hide trashed" ON public.personas_documentos;
CREATE POLICY "personas_documentos: hide trashed" ON public.personas_documentos
  AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR public.is_developer());

DROP POLICY IF EXISTS "subcontratistas_documentos: hide trashed" ON public.subcontratistas_documentos;
CREATE POLICY "subcontratistas_documentos: hide trashed" ON public.subcontratistas_documentos
  AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR public.is_developer());

-- ESTABLECIMIENTOS_DENUNCIAS — descubrir su policy de SELECT existente.
-- Reusa el patrón de acceso por establecimiento. (Si la policy original tiene
-- otro nombre, este DROP IF EXISTS es no-op y el CREATE agrega la nueva;
-- revisar que no queden dos policies permisivas de SELECT — ver nota al pie.)
DROP POLICY IF EXISTS "establecimientos_denuncias: select" ON public.establecimientos_denuncias;
CREATE POLICY "establecimientos_denuncias: select" ON public.establecimientos_denuncias FOR SELECT
  USING ((deleted_at IS NULL OR public.is_developer())
         AND public.has_establecimiento_read_access(establecimiento_id));

-- ─── 4. Restringir DELETE físico a developer ────────────────
-- El borrado normal es soft (UPDATE deleted_at = now()). El DELETE físico
-- queda solo para developer (limpieza/GDPR). Mantiene las policies de INSERT/
-- UPDATE existentes intactas.

DROP POLICY IF EXISTS "incidentes: delete" ON public.incidentes;
CREATE POLICY "incidentes: delete" ON public.incidentes FOR DELETE
  USING (public.is_developer());

DROP POLICY IF EXISTS "inspecciones: delete" ON public.inspecciones;
CREATE POLICY "inspecciones: delete" ON public.inspecciones FOR DELETE
  USING (public.is_developer());

DROP POLICY IF EXISTS "mediciones: delete" ON public.mediciones;
CREATE POLICY "mediciones: delete" ON public.mediciones FOR DELETE
  USING (public.is_developer());

DROP POLICY IF EXISTS "riesgos: delete" ON public.riesgos;
CREATE POLICY "riesgos: delete" ON public.riesgos FOR DELETE
  USING (public.is_developer());

-- DOCUMENTOS: borrado físico solo developer en las tablas SIN delete físico en
-- la app (hoy estos docs se reemplazan/upsert, no se borran). Se restringe sin
-- romper ningún flujo existente.
DROP POLICY IF EXISTS "empresas_documentos: delete" ON public.empresas_documentos;
CREATE POLICY "empresas_documentos: delete" ON public.empresas_documentos FOR DELETE
  USING (public.is_developer());

DROP POLICY IF EXISTS "establecimientos_documentos: delete" ON public.establecimientos_documentos;
CREATE POLICY "establecimientos_documentos: delete" ON public.establecimientos_documentos FOR DELETE
  USING (public.is_developer());

DROP POLICY IF EXISTS "personas_documentos: delete (admin dual path)" ON public.personas_documentos;
DROP POLICY IF EXISTS "personas_documentos: delete" ON public.personas_documentos;
CREATE POLICY "personas_documentos: delete" ON public.personas_documentos FOR DELETE
  USING (public.is_developer());

-- subcontratistas_documentos: la acción deleteSubcontratistaDocumento
-- (lib/actions/subcontratista.ts) YA fue convertida a soft-delete (UPDATE
-- deleted_at = now(), sin tocar el archivo en Storage). Por eso ahora sí
-- restringimos el DELETE físico a developer, consistente con el resto.
DROP POLICY IF EXISTS "subcontratistas_documentos: delete" ON public.subcontratistas_documentos;
CREATE POLICY "subcontratistas_documentos: delete" ON public.subcontratistas_documentos FOR DELETE
  USING (public.is_developer());

-- ─── 5. Comentarios ─────────────────────────────────────────
COMMENT ON COLUMN public.incidentes.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
COMMENT ON COLUMN public.inspecciones.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
COMMENT ON COLUMN public.mediciones.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
COMMENT ON COLUMN public.riesgos.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
COMMENT ON COLUMN public.establecimientos_denuncias.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
COMMENT ON COLUMN public.empresas_documentos.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
COMMENT ON COLUMN public.establecimientos_documentos.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
COMMENT ON COLUMN public.personas_documentos.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
COMMENT ON COLUMN public.subcontratistas_documentos.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';

-- ============================================================
-- VERIFICADO contra la base real (lslzhgmoaxgkcjeweqaz) antes de aplicar:
--   - Nombres de policy de SELECT confirmados (DROP IF EXISTS matchea, una sola
--     permisiva por tabla → sin riesgo de doble-permisiva):
--       incidentes: select · inspecciones: select · mediciones: select ·
--       riesgos: select · establecimientos_denuncias: select
--   - No existe `public.documentos`: las tablas reales son empresas_documentos,
--     establecimientos_documentos, personas_documentos, subcontratistas_documentos.
--   - El único delete físico por sesión de usuario era subcontratistas_documentos;
--     su acción ya fue convertida a soft-delete, así que TODAS las tablas de
--     documentos quedan con DELETE físico restringido a developer sin romper flujos.
-- ============================================================
