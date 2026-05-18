-- ============================================================
-- Horarios por día de la semana por establecimiento
-- dia_semana: 0=domingo, 1=lunes, ..., 6=sábado (ISO JS)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.horarios_establecimiento (
  id                  uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  establecimiento_id  uuid         NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  dia_semana          smallint     NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio         time,
  hora_fin            time,
  activo              boolean      NOT NULL DEFAULT true,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (establecimiento_id, dia_semana)
);

CREATE INDEX IF NOT EXISTS horarios_establecimiento_est_idx
  ON public.horarios_establecimiento (establecimiento_id);

ALTER TABLE public.horarios_establecimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read horarios"
  ON public.horarios_establecimiento FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated write horarios"
  ON public.horarios_establecimiento FOR ALL TO authenticated USING (true) WITH CHECK (true);
