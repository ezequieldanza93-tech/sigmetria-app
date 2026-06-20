-- Feedback 70e2d23e (parte 2): fecha de vencimiento de los protocolos de medición.
-- El vencimiento es ANUAL para todos los protocolos (decisión: asumir anual, refinable).
-- Se modela como columna GENERADA = fecha de medición + 1 año, así queda siempre en
-- sincronía sin tocar el flujo de finalización (que para iluminación lo maneja el
-- sistema de evidencia/PDF). El legajo técnico la lee para mostrar el vencimiento.
--
-- Base de cálculo:
--   ruido / pat / carga térmica / iluminación  → fecha_medicion
--   ergonomía                                   → fecha_evaluacion

ALTER TABLE public.medicion_ruido
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date
  GENERATED ALWAYS AS ((fecha_medicion + INTERVAL '1 year')::date) STORED;

ALTER TABLE public.medicion_pat
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date
  GENERATED ALWAYS AS ((fecha_medicion + INTERVAL '1 year')::date) STORED;

ALTER TABLE public.medicion_carga_termica
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date
  GENERATED ALWAYS AS ((fecha_medicion + INTERVAL '1 year')::date) STORED;

ALTER TABLE public.medicion_iluminacion
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date
  GENERATED ALWAYS AS ((fecha_medicion + INTERVAL '1 year')::date) STORED;

ALTER TABLE public.ergonomia_evaluaciones
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date
  GENERATED ALWAYS AS ((fecha_evaluacion + INTERVAL '1 year')::date) STORED;
