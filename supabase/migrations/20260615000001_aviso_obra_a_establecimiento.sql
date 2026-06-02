-- ============================================================
-- Aviso de Obra (AIO): mover de nivel EMPRESA a ESTABLECIMIENTO
-- ============================================================
--
-- QUÉ HACE:
-- El tipo de documento "Aviso de Obra (AIO)" aplicaba a nivel empresa.
-- Pasa a aplicar a nivel establecimiento (es un documento por obra/sitio).
-- Verificado: 0 documentos de empresa cargados de este tipo → sin huérfanos.
--
-- ROLLBACK:
--   UPDATE documentos_tipos SET aplica_empresa = true, aplica_establecimiento = false
--   WHERE nombre = 'Aviso de Obra (AIO)';
-- ============================================================

UPDATE public.documentos_tipos
SET aplica_empresa = false,
    aplica_establecimiento = true
WHERE nombre = 'Aviso de Obra (AIO)';
