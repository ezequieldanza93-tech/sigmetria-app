-- ============================================================
-- Sigmetría — Ajustes librería de documentos
-- ============================================================

-- Registro de Capacitación → pasa a Establecimientos
UPDATE public.documento_tipos
  SET aplica_empresa    = false,
      aplica_establecimiento = true,
      aplica_empleado   = false,
      updated_at        = now()
  WHERE nombre = 'Registro de Capacitación';

-- Registro de Inducción → nuevo, aplica a Personas
INSERT INTO public.documento_tipos (nombre, aplica_empresa, aplica_establecimiento, aplica_empleado)
  VALUES ('Registro de Inducción', false, false, true);
