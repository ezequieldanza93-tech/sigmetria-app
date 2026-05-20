-- ============================================================
-- Sigmetría HyS — Asistencia Diaria: Yearly Partitioning
--
-- Migrates asistencia_diaria to declarative partitioning by
-- year on fecha. The table is currently empty (0 rows), so
-- we can safely drop and recreate.
--
-- Partition range: 2026 (current) through 2031 (+5 years)
-- New partitions will be created via a yearly cron or manual
-- migration as time passes.
-- ============================================================

-- Drop existing table (CASCADE drops RLS policies — recreated below)
DROP TABLE IF EXISTS public.asistencia_diaria CASCADE;

-- Recreate as partitioned table
-- PK includes fecha because partition key must be part of PK
CREATE TABLE public.asistencia_diaria (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  persona_id          uuid NOT NULL,
  establecimiento_id  uuid NOT NULL,
  fecha               date NOT NULL,
  hora_entrada        timestamptz NOT NULL,
  hora_salida         timestamptz,
  observaciones       text,
  registrado_por      uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, fecha)
) PARTITION BY RANGE (fecha);


-- ============================================================
-- Partitions: yearly ranges
-- ============================================================

CREATE TABLE public.asistencia_diaria_2026 PARTITION OF public.asistencia_diaria
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE public.asistencia_diaria_2027 PARTITION OF public.asistencia_diaria
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE TABLE public.asistencia_diaria_2028 PARTITION OF public.asistencia_diaria
  FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');

CREATE TABLE public.asistencia_diaria_2029 PARTITION OF public.asistencia_diaria
  FOR VALUES FROM ('2029-01-01') TO ('2030-01-01');

CREATE TABLE public.asistencia_diaria_2030 PARTITION OF public.asistencia_diaria
  FOR VALUES FROM ('2030-01-01') TO ('2031-01-01');

CREATE TABLE public.asistencia_diaria_2031 PARTITION OF public.asistencia_diaria
  FOR VALUES FROM ('2031-01-01') TO ('2032-01-01');


-- ============================================================
-- Foreign Keys
-- ============================================================

ALTER TABLE public.asistencia_diaria
  ADD CONSTRAINT asistencia_diaria_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES public.personas_directorio(id) ON DELETE CASCADE;

ALTER TABLE public.asistencia_diaria
  ADD CONSTRAINT asistencia_diaria_establecimiento_id_fkey
  FOREIGN KEY (establecimiento_id) REFERENCES public.establecimientos(id) ON DELETE CASCADE;

ALTER TABLE public.asistencia_diaria
  ADD CONSTRAINT asistencia_diaria_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ============================================================
-- Indexes (created on parent → propagated to all partitions)
-- ============================================================

CREATE INDEX idx_ad_persona ON public.asistencia_diaria (persona_id);
CREATE INDEX idx_ad_establecimiento ON public.asistencia_diaria (establecimiento_id);
CREATE INDEX idx_ad_fecha ON public.asistencia_diaria (fecha);
CREATE INDEX idx_ad_establecimiento_fecha ON public.asistencia_diaria (establecimiento_id, fecha DESC);


-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.asistencia_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asistencia_diaria: select"
  ON public.asistencia_diaria FOR SELECT
  TO authenticated
  USING (public.has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "asistencia_diaria: insert"
  ON public.asistencia_diaria FOR INSERT
  TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "asistencia_diaria: update"
  ON public.asistencia_diaria FOR UPDATE
  TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "asistencia_diaria: delete"
  ON public.asistencia_diaria FOR DELETE
  TO authenticated
  USING (public.has_establecimiento_admin_access(establecimiento_id));
