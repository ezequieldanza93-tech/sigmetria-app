-- Feedback / pedido IPERC (consecuencias → gravedad): al armar la matriz, el usuario
-- elige la CONSECUENCIA concreta (ítem) y la gravedad/valor se autocompleta desde el
-- nivel (categoría) al que pertenece ese ítem. Se persiste el ítem elegido; el nivel
-- (iperc_matriz_riesgos.consecuencia_id) se sigue guardando para el cálculo del nivel
-- de riesgo (probabilidad × gravedad), derivado del ítem.

ALTER TABLE public.iperc_matriz_riesgos
  ADD COLUMN IF NOT EXISTS consecuencia_item_id uuid
  REFERENCES public.iperc_consecuencia_items(id) ON DELETE SET NULL;
