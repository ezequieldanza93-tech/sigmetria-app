-- Trigger: mantiene producto_categoria_map sincronizado con productos.categoria_id.
-- Al crear o cambiar la categoría PRINCIPAL de un producto (desde la UI, un script o
-- SQL directo), el map N:N refleja esa categoría automáticamente. Esto evita la
-- desincronización que hacía que productos se contaran/mostraran en la categoría
-- equivocada (la página filtra por categoria_id; el conteo y el editor usan el map).

CREATE OR REPLACE FUNCTION public.sync_producto_categoria_map()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.categoria_id IS NOT NULL THEN
    -- Asegurar que la categoría principal esté en el map.
    INSERT INTO public.producto_categoria_map (producto_id, categoria_id, es_principal)
    SELECT NEW.id, NEW.categoria_id, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.producto_categoria_map
      WHERE producto_id = NEW.id AND categoria_id = NEW.categoria_id
    );
    -- Si cambió la categoría principal, quitar la anterior del map (residual).
    IF TG_OP = 'UPDATE'
       AND OLD.categoria_id IS DISTINCT FROM NEW.categoria_id
       AND OLD.categoria_id IS NOT NULL THEN
      DELETE FROM public.producto_categoria_map
      WHERE producto_id = NEW.id AND categoria_id = OLD.categoria_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_categoria_map ON public.productos;
CREATE TRIGGER trg_sync_categoria_map
AFTER INSERT OR UPDATE OF categoria_id ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.sync_producto_categoria_map();
