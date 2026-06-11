-- Verificación post-migración: confirma que el trigger de auditoría NO rompe las
-- escrituras en una tabla auditada. Transaccional + ROLLBACK → NO cambia datos.
-- Desactiva solo el trigger de límite de plan (billing) para aislar el de auditoría.
-- Si algo de esto falla, psql sale != 0 y el workflow dispara el auto-rollback.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE public.empresas DISABLE TRIGGER check_limit_before_empresa;
DO $$
DECLARE v_cid uuid; v_eid uuid;
BEGIN
  SELECT id INTO v_cid FROM public.consultoras ORDER BY created_at LIMIT 1;
  IF v_cid IS NULL THEN
    RAISE EXCEPTION 'No hay consultoras para la verificación de escritura';
  END IF;
  INSERT INTO public.empresas (consultora_id, razon_social)
  VALUES (v_cid, '__healthcheck_migrate__') RETURNING id INTO v_eid;
  UPDATE public.empresas SET razon_social = '__healthcheck_migrate2__' WHERE id = v_eid;
  RAISE NOTICE 'OK: INSERT+UPDATE en empresas con el trigger de auditoría ACTIVO no se rompió';
END $$;
ROLLBACK;
