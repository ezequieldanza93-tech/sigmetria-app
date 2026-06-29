-- 20260629000001_has_feature.sql
-- Función has_feature: verifica si una consultora tiene habilitado un feature
-- según su plan activo. RPC otorgar_cupo_founder: otorga cupo Fundador de forma
-- atómica con advisory lock por plan (serializa concurrencia).
-- Idempotente. Aplicar vía Management API. NO modificar; crear nueva si hace falta.

-- ─── has_feature ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_feature(
  p_consultora_id uuid,
  p_feature_key text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pf.habilitado
     FROM subscriptions s
     JOIN plan_features pf ON pf.plan_id = s.plan_id AND pf.feature_key = p_feature_key
     WHERE s.consultora_id = p_consultora_id
       AND s.estado IN ('trialing', 'active', 'grace_period')
     ORDER BY s.created_at DESC
     LIMIT 1),
    false
  );
$$;

-- ─── otorgar_cupo_founder ─────────────────────────────────
-- RPC atómica para otorgar cupo Fundador.
-- Usa advisory lock a nivel transacción para serializar otorgamientos concurrentes
-- sobre el mismo plan.
CREATE OR REPLACE FUNCTION public.otorgar_cupo_founder(
  p_subscription_id uuid,
  p_plan_id uuid,
  p_discount_pct int DEFAULT 20
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_cupos_disponibles int;
BEGIN
  -- Lock a nivel plan para serializar otorgamientos concurrentes
  PERFORM pg_advisory_xact_lock(hashtext(p_plan_id::text));

  -- Verificar cupos disponibles:
  -- founder_slots_total - founder_seed_taken - count(subs fundadoras activas)
  SELECT GREATEST(0, p.founder_slots_total - p.founder_seed_taken -
    COUNT(s2.id) FILTER (WHERE s2.is_founder = true))
  INTO v_cupos_disponibles
  FROM plans p
  LEFT JOIN subscriptions s2 ON s2.plan_id = p.id AND s2.is_founder = true
  WHERE p.id = p_plan_id
  GROUP BY p.founder_slots_total, p.founder_seed_taken;

  IF v_cupos_disponibles IS NULL OR v_cupos_disponibles <= 0 THEN
    RETURN false;
  END IF;

  -- Otorgar cupo
  UPDATE subscriptions
  SET is_founder = true,
      founder_discount_pct = p_discount_pct,
      updated_at = now()
  WHERE id = p_subscription_id;

  RETURN true;
END;
$$;
