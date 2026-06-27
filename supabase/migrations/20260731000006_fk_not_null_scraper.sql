-- NOT NULL en FKs de composición pura del scraper (hallazgo INTEG-002)
-- Únicas 3 de 200 FK nullable que son inequívocamente obligatorias: un producto/variante/asset
-- de scraper NO existe sin su catálogo/producto padre. CASCADE + 0 nulls + el código siempre las setea.
-- El resto de FK nullable se deja: SET NULL (contradicción), consultora_id (patrón librería híbrida
-- NULL=genérico), o vínculos opcionales por dominio.

ALTER TABLE public.scraper_productos          ALTER COLUMN catalogo_id SET NOT NULL;
ALTER TABLE public.scraper_producto_variantes ALTER COLUMN producto_id SET NOT NULL;
ALTER TABLE public.scraper_producto_assets    ALTER COLUMN producto_id SET NOT NULL;
