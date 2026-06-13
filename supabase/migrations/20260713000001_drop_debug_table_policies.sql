-- Limpieza: elimina la función de introspección de debug `_debug_table_policies`
-- (creada de forma temporal en 20260712000001 para diagnosticar drift de RLS en prod).
-- Ya cumplió su propósito y NO debe quedar en la base de producción (higiene de
-- compliance: nada de funciones `_debug_*` en el esquema productivo).
--
-- DROP idempotente: seguro de re-aplicar; si la función no existe, no hace nada.
DROP FUNCTION IF EXISTS public._debug_table_policies(text);
