-- Feedback b9f881c0: el instrumento de medición se clasifica por la SUBCATEGORÍA del
-- catálogo (categoría "Mediciones HyS" de la librería EPC) y su MODELO sale del catálogo
-- de productos. La subcategoría (productos_componentes) reemplaza al viejo tipo_id
-- (mediciones_instrumentos_tipos). Decisión de Ezequiel: un solo clasificador = la subcategoría.
--
-- Esta migración A es ADITIVA (no rompe el código viejo): agrega las columnas + backfill.
-- El DROP de tipo_id y de la tabla vieja va en la migración B, DESPUÉS de deployar el código nuevo.

ALTER TABLE public.mediciones_instrumentos
  ADD COLUMN IF NOT EXISTS producto_id     uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategoria_id uuid REFERENCES public.productos_componentes(id) ON DELETE SET NULL;

-- modelo pasa a derivarse del producto (productos.nombre); lo dejamos nullable porque los
-- instrumentos nuevos lo toman del catálogo y los legacy conservan su texto.
ALTER TABLE public.mediciones_instrumentos ALTER COLUMN modelo DROP NOT NULL;

-- Backfill: mapear el tipo viejo de cada instrumento existente → subcategoría de "Mediciones HyS".
UPDATE public.mediciones_instrumentos mi
SET subcategoria_id = c.id
FROM public.mediciones_instrumentos_tipos t
JOIN public.productos_componentes c
  ON c.categoria_id = '318ea652-2295-4d3f-8ffb-f8f047f84fe6'
 AND c.nombre = CASE t.nombre
   WHEN 'Luxómetro'                 THEN 'Iluminación'
   WHEN 'Decibelímetro'             THEN 'Ruido'
   WHEN 'Sonómetro'                 THEN 'Ruido'
   WHEN 'Dosímetro'                 THEN 'Ruido'
   WHEN 'Telurímetro'               THEN 'Puesta a Tierra (PAT)'
   WHEN 'Monitor de Estrés Térmico' THEN 'Carga Térmica'
   WHEN 'Vibrómetro'                THEN 'Vibraciones'
   ELSE 'Otras Mediciones HyS'
 END
WHERE mi.tipo_id = t.id;

CREATE INDEX IF NOT EXISTS idx_mediciones_instrumentos_subcategoria ON public.mediciones_instrumentos(subcategoria_id);
CREATE INDEX IF NOT EXISTS idx_mediciones_instrumentos_producto ON public.mediciones_instrumentos(producto_id);
