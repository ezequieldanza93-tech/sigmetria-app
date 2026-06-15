-- Agenda: hora de ejecución confiable de una gestión.
--
-- Hasta ahora la única marca temporal de la ejecución era `fecha_ejecutada`
-- (un date, sin hora) y, cuando había geolocalización, `geo_captured_at`. Eso
-- no alcanza para ordenar dentro de un mismo día / misma fecha planificada ni
-- para mostrar la HORA real en que se completó/finalizó la gestión.
--
-- `ejecutado_at` se setea (= now()) SOLO al COMPLETAR/FINALIZAR realmente una
-- gestión (finalización de formulario, reporte fotográfico, mediciones, cálculo
-- de carga de fuego). En los BORRADORES (guardarBorrador) queda NULL.
--
-- gestiones_registros está PARTICIONADA por fecha_planificada: el ADD COLUMN
-- sobre la tabla padre se propaga automáticamente a todas las particiones.
ALTER TABLE public.gestiones_registros
  ADD COLUMN IF NOT EXISTS ejecutado_at timestamptz;

COMMENT ON COLUMN public.gestiones_registros.ejecutado_at IS
  'Timestamp (con hora) de la COMPLETACIÓN/FINALIZACIÓN real de la gestión (now() al finalizar). NULL en borradores y en registros que nunca se ejecutaron. Complementa fecha_ejecutada (date sin hora).';
