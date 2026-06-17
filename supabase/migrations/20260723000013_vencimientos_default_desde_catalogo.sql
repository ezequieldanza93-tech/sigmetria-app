-- ============================================================
-- Config de vencimientos por consultora — default DESDE el catálogo
-- ============================================================
-- Hasta ahora init_configuracion_vencimientos creaba las filas por
-- consultora con los defaults de tabla (tiene_vencimiento=false,
-- dias_aviso=7), ignorando lo que dice el catálogo global.
--
-- El catálogo (documentos_tipos) ya quedó fijado con su DEFAULT de alerta
-- por tipo (requiere_alerta / dias_alerta). Esta migración hace que la
-- config por consultora HEREDE ese default: "por defecto es como están
-- para todas las consultoras". Cada consultora sigue pudiendo silenciar
-- (tiene_vencimiento=false / activo=false) o cambiar dias_aviso después.
--
-- Mapeo: requiere_alerta → tiene_vencimiento, dias_alerta → dias_aviso.
-- Idempotente: CREATE OR REPLACE FUNCTION + backfill sólo de filas NO
-- customizadas (updated_at = created_at = nunca editadas por el usuario).
-- ============================================================

-- ─── 1. init hereda los defaults del catálogo ───────────────
CREATE OR REPLACE FUNCTION public.init_configuracion_vencimientos(p_consultora_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Documentos de empresa
  INSERT INTO public.configuracion_vencimientos
    (consultora_id, tipo_entidad, nombre, tiene_vencimiento, dias_aviso)
  SELECT p_consultora_id, 'empresa', dt.nombre, dt.requiere_alerta, dt.dias_alerta
  FROM public.documentos_tipos dt
  WHERE dt.is_active AND dt.aplica_empresa
    AND NOT EXISTS (
      SELECT 1 FROM public.configuracion_vencimientos cv
      WHERE cv.consultora_id = p_consultora_id
        AND cv.tipo_entidad = 'empresa'
        AND cv.nombre = dt.nombre
    );

  -- Documentos de establecimiento
  INSERT INTO public.configuracion_vencimientos
    (consultora_id, tipo_entidad, nombre, tiene_vencimiento, dias_aviso)
  SELECT p_consultora_id, 'establecimiento', dt.nombre, dt.requiere_alerta, dt.dias_alerta
  FROM public.documentos_tipos dt
  WHERE dt.is_active AND dt.aplica_establecimiento
    AND NOT EXISTS (
      SELECT 1 FROM public.configuracion_vencimientos cv
      WHERE cv.consultora_id = p_consultora_id
        AND cv.tipo_entidad = 'establecimiento'
        AND cv.nombre = dt.nombre
    );

  -- Documentos de persona
  INSERT INTO public.configuracion_vencimientos
    (consultora_id, tipo_entidad, nombre, tiene_vencimiento, dias_aviso)
  SELECT p_consultora_id, 'persona', dt.nombre, dt.requiere_alerta, dt.dias_alerta
  FROM public.documentos_tipos dt
  WHERE dt.is_active AND dt.aplica_empleado
    AND NOT EXISTS (
      SELECT 1 FROM public.configuracion_vencimientos cv
      WHERE cv.consultora_id = p_consultora_id
        AND cv.tipo_entidad = 'persona'
        AND cv.nombre = dt.nombre
    );

  -- Gestiones (sin catálogo de alerta: quedan con default de tabla)
  INSERT INTO public.configuracion_vencimientos (consultora_id, tipo_entidad, nombre)
  SELECT p_consultora_id, 'gestion', g.nombre
  FROM public.gestiones g
  WHERE g.tiene_entregable
    AND NOT EXISTS (
      SELECT 1 FROM public.configuracion_vencimientos cv
      WHERE cv.consultora_id = p_consultora_id
        AND cv.tipo_entidad = 'gestion'
        AND cv.nombre = g.nombre
    );
END;
$$;

-- ─── 2. Backfill de filas existentes NO customizadas ────────
-- Sólo filas de documento (no 'gestion') que nunca fueron editadas por el
-- usuario (updated_at = created_at). No se toca updated_at para preservar
-- el marcador y mantener el backfill idempotente.
UPDATE public.configuracion_vencimientos cv
SET tiene_vencimiento = dt.requiere_alerta,
    dias_aviso        = dt.dias_alerta
FROM public.documentos_tipos dt
WHERE cv.nombre = dt.nombre
  AND cv.tipo_entidad <> 'gestion'
  AND cv.updated_at = cv.created_at;
