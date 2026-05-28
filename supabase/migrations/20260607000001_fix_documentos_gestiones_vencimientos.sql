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

-- Crear nuevos tipos Análisis
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

-- Desactivar los viejos Estudios de Agua (soft delete para no romper documentos existentes)
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
--    Renombrar Estudios viejos a Análisis, eliminar - 2
-- ============================================================

-- Renombrar entries existentes en configuracion_vencimientos
UPDATE public.configuracion_vencimientos
SET nombre = 'Análisis Bacteriológico del Agua', updated_at = now()
WHERE nombre = 'Estudio Bacteriológico del Agua para consumo humano'
  AND tipo_entidad = 'establecimiento';

UPDATE public.configuracion_vencimientos
SET nombre = 'Análisis Fisicoquímico del Agua', updated_at = now()
WHERE nombre = 'Estudio Físico/Químico del Agua para consumo humano'
  AND tipo_entidad = 'establecimiento';

-- Agregar Análisis si no existen (por si no había Estudios viejos)
INSERT INTO public.configuracion_vencimientos (consultora_id, tipo_entidad, nombre)
SELECT cv.consultora_id, 'establecimiento', 'Análisis Bacteriológico del Agua'
FROM public.configuracion_vencimientos cv
WHERE cv.tipo_entidad = 'establecimiento'
  AND NOT EXISTS (
    SELECT 1 FROM public.configuracion_vencimientos cv2
    WHERE cv2.consultora_id = cv.consultora_id
      AND cv2.tipo_entidad = 'establecimiento'
      AND cv2.nombre = 'Análisis Bacteriológico del Agua'
  )
GROUP BY cv.consultora_id;

INSERT INTO public.configuracion_vencimientos (consultora_id, tipo_entidad, nombre)
SELECT cv.consultora_id, 'establecimiento', 'Análisis Fisicoquímico del Agua'
FROM public.configuracion_vencimientos cv
WHERE cv.tipo_entidad = 'establecimiento'
  AND NOT EXISTS (
    SELECT 1 FROM public.configuracion_vencimientos cv2
    WHERE cv2.consultora_id = cv.consultora_id
      AND cv2.tipo_entidad = 'establecimiento'
      AND cv2.nombre = 'Análisis Fisicoquímico del Agua'
  )
GROUP BY cv.consultora_id;

-- Eliminar configuracion_vencimientos para gestiones con - 2
DELETE FROM public.configuracion_vencimientos
WHERE nombre LIKE '% - 2';
