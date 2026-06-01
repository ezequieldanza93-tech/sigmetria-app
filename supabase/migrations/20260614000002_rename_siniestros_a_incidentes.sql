-- ============================================================
-- RENAME entidad "Siniestros" -> "Incidentes"
-- ============================================================
--
-- QUÉ HACE:
-- Renombra físicamente la tabla `siniestros` -> `incidentes` (el nombre
-- quedó libre tras 20260614000001) y migra el esquema al nuevo dominio:
--   * Enums nuevos: incidente_tipo (incidente, accidente_leve,
--     accidente_moderado, accidente_grave) e incidente_estado
--     (pendiente, en_investigacion, cerrado — mismos estados).
--   * Columna `tipo`   -> incidente_tipo
--   * Columna `estado` -> incidente_estado
--   * Drop de los enums viejos siniestro_tipo / siniestro_estado.
--   * Renombre de constraints/índices a prefijo incidentes_* / idx_inc_*.
--   * Recreación de las 4 RLS policies como "incidentes: ...".
--
-- La tabla está VACÍA → el cast de enum con USING es trivial (no hay
-- filas con los valores viejos accidente/casi_accidente/enfermedad_profesional).
--
-- COLUMNA GENERADA: `dias_perdidos_calculados` (GENERATED ALWAYS AS ...
-- STORED) SOBREVIVE intacta al RENAME de la tabla — su expresión referencia
-- columnas por nombre dentro de la misma tabla, no el nombre de la tabla.
-- NO se toca.
--
-- TRIGGER: el trigger de updated_at se llama `set_updated_at` (nombre
-- genérico, igual en todas las tablas) → sobrevive el rename sin cambios.
--
-- ROLLBACK:
--   BEGIN;
--   ALTER TABLE public.incidentes RENAME TO siniestros;
--   CREATE TYPE public.siniestro_tipo AS ENUM
--     ('accidente','incidente','casi_accidente','enfermedad_profesional');
--   CREATE TYPE public.siniestro_estado AS ENUM
--     ('pendiente','en_investigacion','cerrado');
--   ALTER TABLE public.siniestros
--     ALTER COLUMN tipo   TYPE public.siniestro_tipo
--       USING (CASE tipo::text WHEN 'accidente_leve' THEN 'accidente'
--                              WHEN 'accidente_moderado' THEN 'accidente'
--                              WHEN 'accidente_grave' THEN 'accidente'
--                              ELSE 'incidente' END)::public.siniestro_tipo,
--     ALTER COLUMN estado TYPE public.siniestro_estado
--       USING estado::text::public.siniestro_estado;
--   ALTER TABLE public.siniestros ALTER COLUMN estado SET DEFAULT 'pendiente';
--   DROP TYPE public.incidente_tipo;
--   DROP TYPE public.incidente_estado;
--   ALTER TABLE public.siniestros RENAME CONSTRAINT incidentes_pkey TO siniestros_pkey;
--   ALTER TABLE public.siniestros RENAME CONSTRAINT incidentes_establecimiento_id_fkey TO siniestros_establecimiento_id_fkey;
--   ALTER TABLE public.siniestros RENAME CONSTRAINT incidentes_persona_id_fkey TO siniestros_persona_id_fkey;
--   ALTER TABLE public.siniestros RENAME CONSTRAINT incidentes_reportado_por_fkey TO siniestros_reportado_por_fkey;
--   ALTER INDEX idx_inc_establecimiento RENAME TO idx_sin_establecimiento;
--   ALTER INDEX idx_inc_persona RENAME TO idx_sin_persona;
--   ALTER INDEX idx_inc_fecha RENAME TO idx_sin_fecha;
--   DROP POLICY ... CREATE POLICY "siniestros: ..." (las 4);
--   COMMIT;
-- ============================================================

BEGIN;

-- ── 1. Enums nuevos ──────────────────────────────────────────
CREATE TYPE public.incidente_tipo AS ENUM (
  'incidente', 'accidente_leve', 'accidente_moderado', 'accidente_grave'
);
CREATE TYPE public.incidente_estado AS ENUM (
  'pendiente', 'en_investigacion', 'cerrado'
);

-- ── 2. Renombrar la tabla ────────────────────────────────────
ALTER TABLE public.siniestros RENAME TO incidentes;

-- ── 3. Migrar columnas a los enums nuevos (tabla vacía) ──────
ALTER TABLE public.incidentes
  ALTER COLUMN tipo TYPE public.incidente_tipo
    USING tipo::text::public.incidente_tipo;

ALTER TABLE public.incidentes
  ALTER COLUMN estado DROP DEFAULT;

ALTER TABLE public.incidentes
  ALTER COLUMN estado TYPE public.incidente_estado
    USING estado::text::public.incidente_estado;

ALTER TABLE public.incidentes
  ALTER COLUMN estado SET DEFAULT 'pendiente';

-- ── 4. Drop enums viejos (ya sin referencias) ────────────────
DROP TYPE IF EXISTS public.siniestro_tipo;
DROP TYPE IF EXISTS public.siniestro_estado;

-- ── 5. Renombrar constraints / FKs / pkey ────────────────────
ALTER TABLE public.incidentes RENAME CONSTRAINT siniestros_pkey TO incidentes_pkey;
ALTER TABLE public.incidentes RENAME CONSTRAINT siniestros_establecimiento_id_fkey TO incidentes_establecimiento_id_fkey;
ALTER TABLE public.incidentes RENAME CONSTRAINT siniestros_persona_id_fkey TO incidentes_persona_id_fkey;
ALTER TABLE public.incidentes RENAME CONSTRAINT siniestros_reportado_por_fkey TO incidentes_reportado_por_fkey;

-- ── 6. Renombrar índices ─────────────────────────────────────
ALTER INDEX IF EXISTS idx_sin_establecimiento RENAME TO idx_inc_establecimiento;
ALTER INDEX IF EXISTS idx_sin_persona         RENAME TO idx_inc_persona;
ALTER INDEX IF EXISTS idx_sin_fecha           RENAME TO idx_inc_fecha;

-- ── 7. Recrear las 4 RLS policies con nombres nuevos ─────────
DROP POLICY IF EXISTS "siniestros: select" ON public.incidentes;
DROP POLICY IF EXISTS "siniestros: insert" ON public.incidentes;
DROP POLICY IF EXISTS "siniestros: update" ON public.incidentes;
DROP POLICY IF EXISTS "siniestros: delete" ON public.incidentes;

CREATE POLICY "incidentes: select" ON public.incidentes FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));
CREATE POLICY "incidentes: insert" ON public.incidentes FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "incidentes: update" ON public.incidentes FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "incidentes: delete" ON public.incidentes FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));

COMMIT;
