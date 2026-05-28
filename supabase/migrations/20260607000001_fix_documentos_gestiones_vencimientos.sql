-- ============================================================
-- Sigmetría HyS — Fix documentos, gestiones y vencimientos
--
-- 1. Renombrar Estudios de Agua → Análisis en documentos_tipos
-- 2. Eliminar gestiones duplicadas que terminan con " - 2"
-- 3. Agregar auto_download_gestion a profiles
-- 4. Actualizar configuracion_vencimientos existentes
-- ============================================================

-- ============================================================
-- 1. Renombrar Estudios de Agua → Análisis en documentos_tipos
-- ============================================================

INSERT INTO public.documentos_tipos (nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, aplica_subcontratista)
SELECT 'Análisis Bacteriológico del Agua', false, true, false, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.documentos_tipos WHERE nombre = 'Análisis Bacteriológico del Agua'
);

INSERT INTO public.documentos_tipos (nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, aplica_subcontratista)
SELECT 'Análisis Fisicoquímico del Agua', false, true, false, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.documentos_tipos WHERE nombre = 'Análisis Fisicoquímico del Agua'
);

UPDATE public.documentos_tipos
SET is_active = false, updated_at = now()
WHERE nombre IN (
  'Estudio Bacteriológico del Agua para consumo humano',
  'Estudio Físico/Químico del Agua para consumo humano'
);

-- ============================================================
-- 2. Eliminar gestiones duplicadas que terminan con " - 2"
-- ============================================================

DELETE FROM public.gestiones
WHERE nombre LIKE '% - 2';

-- ============================================================
-- 3. Agregar auto_download_gestion a profiles
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auto_download_gestion boolean NOT NULL DEFAULT true;

-- ============================================================
-- 4. Actualizar configuracion_vencimientos existentes
--    Primero eliminar targets que causarían conflictos UNIQUE,
--    luego renombrar, luego eliminar - 2
-- ============================================================

DELETE FROM public.configuracion_vencimientos cv_del
USING public.configuracion_vencimientos cv_old
WHERE cv_del.consultora_id = cv_old.consultora_id
  AND cv_del.tipo_entidad = cv_old.tipo_entidad
  AND cv_del.nombre = 'Análisis Fisicoquímico del Agua'
  AND cv_old.nombre = 'Estudio Físico/Químico del Agua para consumo humano'
  AND cv_old.tipo_entidad = 'establecimiento';

DELETE FROM public.configuracion_vencimientos cv_del
USING public.configuracion_vencimientos cv_old
WHERE cv_del.consultora_id = cv_old.consultora_id
  AND cv_del.tipo_entidad = cv_old.tipo_entidad
  AND cv_del.nombre = 'Análisis Bacteriológico del Agua'
  AND cv_old.nombre = 'Estudio Bacteriológico del Agua para consumo humano'
  AND cv_old.tipo_entidad = 'establecimiento';

UPDATE public.configuracion_vencimientos
SET nombre = 'Análisis Bacteriológico del Agua', updated_at = now()
WHERE nombre = 'Estudio Bacteriológico del Agua para consumo humano'
  AND tipo_entidad = 'establecimiento';

UPDATE public.configuracion_vencimientos
SET nombre = 'Análisis Fisicoquímico del Agua', updated_at = now()
WHERE nombre = 'Estudio Físico/Químico del Agua para consumo humano'
  AND tipo_entidad = 'establecimiento';

DELETE FROM public.configuracion_vencimientos
WHERE nombre LIKE '% - 2';
