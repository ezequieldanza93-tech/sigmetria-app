-- ============================================================
-- Sigmetría HyS — Normalización 3NF: subcontratistas
--
-- subcontratistas tiene relación 1:1 con organizaciones_externas
-- (organizacion_id UNIQUE) pero duplica datos maestros que deberían
-- pertenecer a la organización: domicilio, localidad_id, código
-- postal, CUIT, tipo de identidad impositiva.
--
-- Se migran esas columnas a organizaciones_externas y se eliminan
-- de subcontratistas, dejando solo los campos específicos de
-- subcontratista (rubro, tipo_estab, actividad, ART, etc.).
--
-- La tabla está vacía (0 rows), cambios seguros.
-- ============================================================


-- ============================================================
-- 1. Agregar columnas de dirección/identidad a organizaciones
-- ============================================================

ALTER TABLE public.organizaciones_externas
  ADD COLUMN domicilio text,
  ADD COLUMN localidad_id uuid REFERENCES public.localidades(id) ON DELETE SET NULL,
  ADD COLUMN codigo_postal text,
  ADD COLUMN cuit text,
  ADD COLUMN tipo_identidad_impositiva text
    CHECK (tipo_identidad_impositiva IN ('CUIT', 'CUIL', 'CDI'));

-- Índices para las nuevas columnas
CREATE INDEX idx_org_ext_cuit ON public.organizaciones_externas (cuit)
  WHERE cuit IS NOT NULL;

CREATE INDEX idx_org_ext_localidad ON public.organizaciones_externas (localidad_id)
  WHERE localidad_id IS NOT NULL;


-- ============================================================
-- 2. Eliminar columnas duplicadas de subcontratistas
-- ============================================================

ALTER TABLE public.subcontratistas
  DROP COLUMN domicilio,
  DROP COLUMN localidad_id,
  DROP COLUMN codigo_postal,
  DROP COLUMN cuit,
  DROP COLUMN tipo_identidad_impositiva;
