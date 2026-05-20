-- ============================================================
-- Sigmetría HyS — Trial state machine + Feature gates
-- 1. Función check_plan_limit() — valida límites por recurso
-- 2. Triggers hard limit en gestiones_registros, empresas,
--    establecimientos, establecimientos_horarios
-- 3. Función transition_subscription_state() — máquina de estados
-- 4. Función run_subscription_cron() — evaluación diaria
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS check_limit_before_empresa ON public.empresas;
--   DROP TRIGGER IF EXISTS check_limit_before_establecimiento ON public.establecimientos;
--   DROP TRIGGER IF EXISTS check_limit_before_gestion_registro ON public.gestiones_registros;
--   DROP TRIGGER IF EXISTS check_limit_before_horario ON public.establecimientos_horarios;
--   DROP FUNCTION IF EXISTS public.check_plan_limit(uuid, text);
--   DROP FUNCTION IF EXISTS public.enforce_plan_limit();
--   DROP FUNCTION IF EXISTS public.transition_subscription_state(uuid, public.subscription_estado, text);
--   DROP FUNCTION IF EXISTS public.run_subscription_cron();
-- ============================================================


-- ============================================================
-- 1. check_plan_limit — devuelve si el recurso puede crearse
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_plan_limit(
  p_consultora_id uuid,
  p_resource      text   -- 'empresas' | 'establecimientos' | 'gestiones_registros' | 'horarios'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_limits        record;
  v_current       int;
  v_max           int;
  v_sub_estado    public.subscription_estado;
BEGIN
  -- Super_admin no tiene límites
  IF public.is_super_admin() THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'super_admin');
  END IF;

  SELECT estado INTO v_sub_estado
  FROM public.subscriptions
  WHERE consultora_id = p_consultora_id;

  -- Sin suscripción → bloqueado
  IF v_sub_estado IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription');
  END IF;

  -- trial_view_only, canceled, expired → solo lectura
  IF v_sub_estado IN ('trial_view_only', 'canceled', 'expired') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', v_sub_estado::text);
  END IF;

  SELECT * INTO v_limits FROM public.get_plan_limits(p_consultora_id);

  CASE p_resource
    WHEN 'empresas' THEN
      v_max := v_limits.max_empresas;
      IF v_max IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
      END IF;
      SELECT COUNT(*) INTO v_current
      FROM public.empresas
      WHERE consultora_id = p_consultora_id AND is_active = true;

    WHEN 'establecimientos' THEN
      v_max := v_limits.max_establecimientos;
      IF v_max IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
      END IF;
      SELECT COUNT(*) INTO v_current
      FROM public.establecimientos est
      JOIN public.empresas e ON e.id = est.empresa_id
      WHERE e.consultora_id = p_consultora_id AND est.is_active = true;

    WHEN 'gestiones_registros' THEN
      v_max := v_limits.max_gestiones_registros;
      IF v_max IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
      END IF;
      SELECT COUNT(*) INTO v_current
      FROM public.gestiones_registros gr
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      JOIN public.establecimientos est ON est.id = ge.establecimiento_id
      JOIN public.empresas e ON e.id = est.empresa_id
      WHERE e.consultora_id = p_consultora_id;

    WHEN 'horarios' THEN
      v_max := v_limits.max_horarios_registros;
      IF v_max IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
      END IF;
      SELECT COUNT(*) INTO v_current
      FROM public.establecimientos_horarios eh
      JOIN public.establecimientos est ON est.id = eh.establecimiento_id
      JOIN public.empresas e ON e.id = est.empresa_id
      WHERE e.consultora_id = p_consultora_id;

    ELSE
      RETURN jsonb_build_object('allowed', true, 'reason', 'unknown_resource');
  END CASE;

  IF v_current >= v_max THEN
    RETURN jsonb_build_object(
      'allowed',  false,
      'reason',   'limit_reached',
      'current',  v_current,
      'max',      v_max,
      'resource', p_resource
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed',  true,
    'current',  v_current,
    'max',      v_max,
    'resource', p_resource
  );
END;
$$;


-- ============================================================
-- 2. enforce_plan_limit — trigger function genérica
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultora_id  uuid;
  v_resource       text;
  v_result         jsonb;
BEGIN
  v_resource := TG_ARGV[0];

  -- Obtener consultora_id según la tabla
  CASE TG_TABLE_NAME
    WHEN 'empresas' THEN
      v_consultora_id := NEW.consultora_id;

    WHEN 'establecimientos' THEN
      SELECT e.consultora_id INTO v_consultora_id
      FROM public.empresas e WHERE e.id = NEW.empresa_id;

    WHEN 'gestiones_registros' THEN
      SELECT e.consultora_id INTO v_consultora_id
      FROM public.gestiones_establecimientos ge
      JOIN public.establecimientos est ON est.id = ge.establecimiento_id
      JOIN public.empresas e ON e.id = est.empresa_id
      WHERE ge.id = NEW.gestion_establecimiento_id;

    WHEN 'establecimientos_horarios' THEN
      SELECT e.consultora_id INTO v_consultora_id
      FROM public.establecimientos est
      JOIN public.empresas e ON e.id = est.empresa_id
      WHERE est.id = NEW.establecimiento_id;
  END CASE;

  IF v_consultora_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_result := public.check_plan_limit(v_consultora_id, v_resource);

  IF NOT (v_result->>'allowed')::boolean THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED: % — recurso: %, actual: %, máximo: %',
      v_result->>'reason',
      v_result->>'resource',
      COALESCE(v_result->>'current', '?'),
      COALESCE(v_result->>'max', '?')
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger en empresas
DROP TRIGGER IF EXISTS check_limit_before_empresa ON public.empresas;
CREATE TRIGGER check_limit_before_empresa
  BEFORE INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('empresas');

-- Trigger en establecimientos
DROP TRIGGER IF EXISTS check_limit_before_establecimiento ON public.establecimientos;
CREATE TRIGGER check_limit_before_establecimiento
  BEFORE INSERT ON public.establecimientos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('establecimientos');

-- Trigger en gestiones_registros
DROP TRIGGER IF EXISTS check_limit_before_gestion_registro ON public.gestiones_registros;
CREATE TRIGGER check_limit_before_gestion_registro
  BEFORE INSERT ON public.gestiones_registros
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('gestiones_registros');

-- Trigger en establecimientos_horarios
DROP TRIGGER IF EXISTS check_limit_before_horario ON public.establecimientos_horarios;
CREATE TRIGGER check_limit_before_horario
  BEFORE INSERT ON public.establecimientos_horarios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit('horarios');


-- ============================================================
-- 3. transition_subscription_state — transición auditada
-- ============================================================
CREATE OR REPLACE FUNCTION public.transition_subscription_state(
  p_subscription_id  uuid,
  p_new_estado       public.subscription_estado,
  p_motivo           text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET estado = p_new_estado
  WHERE id = p_subscription_id;
  -- El trigger subscriptions_audit_state registra el cambio automáticamente
END;
$$;


-- ============================================================
-- 4. run_subscription_cron — evaluación diaria de estados
--    Llamada por pg_cron o Edge Function schedulada
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_subscription_cron()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trialing_expired    int := 0;
  v_view_only_expired   int := 0;
  v_grace_expired       int := 0;
  rec                   record;
BEGIN
  -- trialing → trial_view_only cuando trial_ends_at < now()
  FOR rec IN
    SELECT id FROM public.subscriptions
    WHERE estado = 'trialing'
      AND trial_ends_at < now()
  LOOP
    UPDATE public.subscriptions
    SET estado              = 'trial_view_only',
        trial_used_at_sync  = now()  -- indicativo, no columna real
    WHERE id = rec.id;

    -- Marcar trial_used_at en la consultora
    UPDATE public.consultoras
    SET trial_used_at = now()
    WHERE id = (SELECT consultora_id FROM public.subscriptions WHERE id = rec.id);

    v_trialing_expired := v_trialing_expired + 1;
  END LOOP;

  -- trial_view_only → expired cuando grace_period_ends_at < now()
  FOR rec IN
    SELECT id FROM public.subscriptions
    WHERE estado = 'trial_view_only'
      AND grace_period_ends_at < now()
  LOOP
    UPDATE public.subscriptions
    SET estado = 'expired'
    WHERE id = rec.id;
    v_view_only_expired := v_view_only_expired + 1;
  END LOOP;

  -- grace_period → canceled cuando grace_period_ends_at < now()
  FOR rec IN
    SELECT id FROM public.subscriptions
    WHERE estado = 'grace_period'
      AND grace_period_ends_at < now()
  LOOP
    UPDATE public.subscriptions
    SET estado      = 'canceled',
        canceled_at = now(),
        cancel_reason = 'grace_period_expired'
    WHERE id = rec.id;
    v_grace_expired := v_grace_expired + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'trialing_to_view_only',  v_trialing_expired,
    'view_only_to_expired',   v_view_only_expired,
    'grace_to_canceled',      v_grace_expired,
    'ran_at',                 now()
  );
END;
$$;
