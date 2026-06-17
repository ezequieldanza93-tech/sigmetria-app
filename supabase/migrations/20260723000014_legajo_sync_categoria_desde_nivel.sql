-- ============================================================
-- Legajo: sincronizar categoria_legajo ← nivel (el catálogo manda)
-- ============================================================
-- El legajo técnico (checklist getLegajoEsperados + vista pública
-- legajo-tecnico.tsx) agrupa los documentos por `categoria_legajo` (campo
-- legacy). Pero Sigmetría curó el catálogo por el campo `nivel` (nuevo, el
-- que muestra/edita la pantalla del catálogo). Ambos campos se habían
-- desincronizado (ej: Encomienda Profesional tenía categoria='establecimiento'
-- pero nivel='persona').
--
-- Esta migración hace que `nivel` sea la fuente de verdad: deriva
-- categoria_legajo desde nivel, así toda la curación del catálogo se refleja
-- en el legajo SIN reescribir la lógica de agrupación.
--
-- Mapeo nivel → categoria_legajo:
--   empresa                  → empresa
--   empresa_establecimiento  → empresa_por_establecimiento
--   establecimiento          → establecimiento
--   persona                  → persona
--   persona_empresa          → persona            (no hay categoría propia)
--   persona_establecimiento  → persona_por_establecimiento
--
-- Idempotente: UPDATE determinístico por nivel.
-- ============================================================

UPDATE public.documentos_tipos SET categoria_legajo = 'empresa'
  WHERE nivel = 'empresa' AND categoria_legajo IS DISTINCT FROM 'empresa';

UPDATE public.documentos_tipos SET categoria_legajo = 'empresa_por_establecimiento'
  WHERE nivel = 'empresa_establecimiento' AND categoria_legajo IS DISTINCT FROM 'empresa_por_establecimiento';

UPDATE public.documentos_tipos SET categoria_legajo = 'establecimiento'
  WHERE nivel = 'establecimiento' AND categoria_legajo IS DISTINCT FROM 'establecimiento';

UPDATE public.documentos_tipos SET categoria_legajo = 'persona'
  WHERE nivel IN ('persona', 'persona_empresa') AND categoria_legajo IS DISTINCT FROM 'persona';

UPDATE public.documentos_tipos SET categoria_legajo = 'persona_por_establecimiento'
  WHERE nivel = 'persona_establecimiento' AND categoria_legajo IS DISTINCT FROM 'persona_por_establecimiento';
