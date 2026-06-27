-- INTEG-002: agent_conversations.consultora_id NOT NULL
-- La columna se agregó después de crear las 32 filas de testing → todas con NULL.
-- Backfill: cada conversación pertenece a la consultora de su usuario (via consultoras_members).
-- Todos los user_id de estas filas pertenecen a la consultora 9505c761 (consultora de dev/testing).

UPDATE public.agent_conversations ac
SET consultora_id = cm.consultora_id
FROM public.consultoras_members cm
WHERE cm.user_id = ac.user_id
  AND ac.consultora_id IS NULL;

-- Verificación: si quedaron NULLs (usuario sin consultora_members), abortar con error explícito.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agent_conversations WHERE consultora_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill incompleto: aún existen filas con consultora_id NULL';
  END IF;
END $$;

ALTER TABLE public.agent_conversations
  ALTER COLUMN consultora_id SET NOT NULL;
