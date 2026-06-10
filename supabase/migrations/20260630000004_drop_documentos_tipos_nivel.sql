-- ============================================================
-- 3FN Fix V11: documentos_tipos.nivel text — columna redundante
--
-- Problema: aplica_empresa / aplica_establecimiento / aplica_empleado
-- ya representan el nivel de aplicación de cada tipo de documento,
-- con el constraint chk_aplica_exactamente_un_nivel garantizando
-- que exactamente una sea true. La columna nivel text duplica
-- esta información y puede divergir.
-- ============================================================

-- Verificar que el constraint de integridad existe antes de proceder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_aplica_exactamente_un_nivel'
      AND conrelid = 'public.documentos_tipos'::regclass
  ) THEN
    RAISE EXCEPTION
      'Constraint chk_aplica_exactamente_un_nivel no encontrado en documentos_tipos — '
      'no es seguro eliminar nivel sin garantía de integridad en aplica_*';
  END IF;
END;
$$;

-- Eliminar columna nivel (IF EXISTS por compatibilidad con enviroments
-- donde la columna nunca fue agregada)
ALTER TABLE public.documentos_tipos DROP COLUMN IF EXISTS nivel;
