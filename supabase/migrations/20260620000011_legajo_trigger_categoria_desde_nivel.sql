-- El legajo técnico agrupa por documentos_tipos.categoria_legajo, pero Sigmetría
-- clasifica por `nivel` en el Catálogo de Documentos. La migración 20260723000014
-- sincronizó UNA vez, pero updateDocumentoTipoConfig cambia `nivel` sin tocar
-- categoria_legajo → al re-clasificar, el legajo quedaba desincronizado.
-- Este trigger hace que categoria_legajo SIEMPRE derive de nivel (el catálogo manda),
-- en cada INSERT o UPDATE de nivel. + re-sync de lo existente (idempotente).

CREATE OR REPLACE FUNCTION public.sync_categoria_legajo_desde_nivel()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.nivel IS NOT NULL THEN
    NEW.categoria_legajo := CASE NEW.nivel
      WHEN 'empresa'                 THEN 'empresa'
      WHEN 'empresa_establecimiento' THEN 'empresa_por_establecimiento'
      WHEN 'establecimiento'         THEN 'establecimiento'
      WHEN 'persona'                 THEN 'persona'
      WHEN 'persona_empresa'         THEN 'persona'
      WHEN 'persona_establecimiento' THEN 'persona_por_establecimiento'
      ELSE NEW.categoria_legajo
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sync_categoria_legajo ON public.documentos_tipos;
CREATE TRIGGER sync_categoria_legajo
  BEFORE INSERT OR UPDATE OF nivel ON public.documentos_tipos
  FOR EACH ROW EXECUTE FUNCTION public.sync_categoria_legajo_desde_nivel();

-- Re-sincronizar lo ya cargado (idempotente).
UPDATE public.documentos_tipos SET categoria_legajo = CASE nivel
  WHEN 'empresa'                 THEN 'empresa'
  WHEN 'empresa_establecimiento' THEN 'empresa_por_establecimiento'
  WHEN 'establecimiento'         THEN 'establecimiento'
  WHEN 'persona'                 THEN 'persona'
  WHEN 'persona_empresa'         THEN 'persona'
  WHEN 'persona_establecimiento' THEN 'persona_por_establecimiento'
  ELSE categoria_legajo
END
WHERE nivel IS NOT NULL AND categoria_legajo IS DISTINCT FROM (CASE nivel
  WHEN 'empresa'                 THEN 'empresa'
  WHEN 'empresa_establecimiento' THEN 'empresa_por_establecimiento'
  WHEN 'establecimiento'         THEN 'establecimiento'
  WHEN 'persona'                 THEN 'persona'
  WHEN 'persona_empresa'         THEN 'persona'
  WHEN 'persona_establecimiento' THEN 'persona_por_establecimiento'
  ELSE categoria_legajo
END);
