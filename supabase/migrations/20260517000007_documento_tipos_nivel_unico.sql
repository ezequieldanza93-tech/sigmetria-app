-- ============================================================
-- Sigmetría — documento_tipos: nivel único y lista canónica
-- ============================================================

-- 1. Registro de Capacitación vuelve a Empresas
--    (migración 000006 lo había movido a Establecimientos)
UPDATE public.documento_tipos
  SET aplica_empresa         = true,
      aplica_establecimiento = false,
      aplica_empleado        = false,
      updated_at             = now()
WHERE nombre = 'Registro de Capacitación'
  AND aplica_establecimiento = true;

-- 2. Registro de Capacitación — nueva fila para Personas
INSERT INTO public.documento_tipos (nombre, aplica_empresa, aplica_establecimiento, aplica_empleado)
  SELECT 'Registro de Capacitación', false, false, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documento_tipos
    WHERE nombre = 'Registro de Capacitación' AND aplica_empleado = true
  );

-- 3. Registro de Inducción — desactivar (no pertenece a la librería canónica)
UPDATE public.documento_tipos
  SET is_active  = false,
      updated_at = now()
WHERE nombre = 'Registro de Inducción';

-- 4. Seguro de Vida Obligatorio (SVO) — eliminar duplicado si existe
DELETE FROM public.documento_tipos
WHERE nombre = 'Seguro de Vida Obligatorio (SVO)'
  AND id NOT IN (
    SELECT MIN(id)
    FROM public.documento_tipos
    WHERE nombre = 'Seguro de Vida Obligatorio (SVO)'
  );

-- 5. Constraint: exactamente un nivel por tipo
ALTER TABLE public.documento_tipos
  ADD CONSTRAINT chk_aplica_exactamente_un_nivel
  CHECK (
    (aplica_empresa::int + aplica_establecimiento::int + aplica_empleado::int) = 1
  );
