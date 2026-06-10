-- ============================================================
-- 3FN Fix V14: establecimientos.cantidad_trabajadores
--
-- Problema: es un int manual que puede divergir de la suma
-- real de sus sectores. establecimientos_sectores.cantidad_trabajadores
-- ya está sincronizado por trg_sync_sector_trabajadores.
-- Este trigger extiende la cadena hasta la tabla padre.
-- ============================================================

-- 1. Función trigger
CREATE OR REPLACE FUNCTION public.sync_establecimiento_cantidad_trabajadores()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.establecimiento_id;
  ELSE
    target_id := NEW.establecimiento_id;
  END IF;

  UPDATE public.establecimientos
  SET cantidad_trabajadores = (
    SELECT COALESCE(SUM(cantidad_trabajadores), 0)
    FROM public.establecimientos_sectores
    WHERE establecimiento_id = target_id
      AND is_active = true
  )
  WHERE id = target_id;

  RETURN NULL;
END;
$$;

-- 2. Trigger en establecimientos_sectores
--    Dispara cuando cambia cantidad_trabajadores o is_active (afecta el cómputo)
CREATE TRIGGER trg_sync_establecimiento_trabajadores
  AFTER INSERT OR UPDATE OF cantidad_trabajadores, is_active OR DELETE
  ON public.establecimientos_sectores
  FOR EACH ROW EXECUTE FUNCTION public.sync_establecimiento_cantidad_trabajadores();

-- 3. Backfill: alinear valores actuales con la suma real
UPDATE public.establecimientos e
SET cantidad_trabajadores = (
  SELECT COALESCE(SUM(es.cantidad_trabajadores), 0)
  FROM public.establecimientos_sectores es
  WHERE es.establecimiento_id = e.id
    AND es.is_active = true
);
