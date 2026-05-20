-- ============================================================
-- Sigmetría HyS — Schema comments para claridad arquitectónica
-- ============================================================

COMMENT ON TABLE public.documento_tipos IS
  'Catálogo de tipos de documento con reglas de aplicación (nivel empresa/establecimiento/persona). NO reemplaza documentos.tipo (enum) — son complementarios: el enum clasifica el documento, este catálogo define qué reglas aplican.';

COMMENT ON COLUMN public.documentos.tipo IS
  'Clasificación del documento (habilitacion, seguro, certificado, etc.). No confundir con documento_tipos (catálogo de reglas). Son complementarios.';

COMMENT ON TABLE public.mediciones_tipos IS
  'Catálogo de tipos de medición ambiental. Reemplaza al enum medicion_tipo. unidad_default_id es referencia informativa — la unidad real de cada medición está en mediciones.unidad_id.';

COMMENT ON COLUMN public.registro_gestiones.index IS
  'Orden del ítem dentro de un grupo gestion_establecimiento. Entero >= 0. No necesariamente contiguo.';
