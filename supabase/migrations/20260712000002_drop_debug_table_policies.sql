-- Elimina la función temporal de introspección usada para diagnosticar el RLS
-- de empresas (la policy en prod estaba correcta; no hubo drift).
DROP FUNCTION IF EXISTS public._debug_table_policies(text);
