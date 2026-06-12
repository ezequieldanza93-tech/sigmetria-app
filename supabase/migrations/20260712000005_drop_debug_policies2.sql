-- Elimina la función temporal de introspección de policies usada para diagnosticar
-- que el 42501 de empresas venía del RETURNING (policy de SELECT con función STABLE),
-- no del WITH CHECK.
DROP FUNCTION IF EXISTS public._debug_policies2(text);
