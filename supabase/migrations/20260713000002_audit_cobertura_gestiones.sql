-- ============================================================
-- FIX cadena de custodia (SRT Disp. 15/2026 — estándares 2 Trazabilidad y 8 Auditoría).
--
-- Problema (verificado en prod 2026-06-13): el flujo central de H&S —recorridas y
-- observaciones— NO generaba NINGUNA fila en audit_log. Conteos reales: 183
-- gestiones_registros, 27 gestiones_observaciones, 47 gestiones_establecimientos →
-- 0 filas auditadas. Causa: el loop de cobertura de 20260702000001 colgó el trigger
-- sobre los nombres VIEJOS `registro_gestiones`/`observaciones_gestiones`, renombrados
-- a `gestiones_registros`/`gestiones_observaciones` en 20260522000001 (antes) → los
-- salteó en silencio. Ninguna migración posterior los recreó.
--
-- Esta migración:
--   1. Extiende fn_resolve_consultora_id para resolver el tenant de las tablas de
--      gestiones por su FK (no tienen consultora_id/empresa_id/establecimiento_id
--      directo) → sus eventos caen en la cadena de SU consultora, no en la global.
--   2. Cuelga el trigger de auditoría en los nombres REALES.
--
-- Nota: el trigger audita de acá en adelante; las filas históricas pre-trigger no se
-- encadenan retroactivamente (comportamiento normal de una cadena de custodia).
-- Aditiva e idempotente.
-- ============================================================

-- ── 1. Resolución de tenant para las tablas de gestiones ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_resolve_consultora_id(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cid uuid;
  v_eid uuid;
  v_est uuid;
BEGIN
  IF p_row ? 'consultora_id' AND p_row->>'consultora_id' IS NOT NULL THEN
    RETURN (p_row->>'consultora_id')::uuid;
  END IF;

  IF p_row ? 'empresa_id' AND p_row->>'empresa_id' IS NOT NULL THEN
    v_eid := (p_row->>'empresa_id')::uuid;
    SELECT consultora_id INTO v_cid FROM public.empresas WHERE id = v_eid;
    RETURN v_cid;
  END IF;

  IF p_row ? 'establecimiento_id' AND p_row->>'establecimiento_id' IS NOT NULL THEN
    v_est := (p_row->>'establecimiento_id')::uuid;
    SELECT e.consultora_id INTO v_cid
    FROM public.establecimientos est
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE est.id = v_est;
    RETURN v_cid;
  END IF;

  -- gestiones_registros → gestiones_establecimientos → establecimientos → empresas
  IF p_row ? 'gestion_establecimiento_id' AND p_row->>'gestion_establecimiento_id' IS NOT NULL THEN
    SELECT e.consultora_id INTO v_cid
    FROM public.gestiones_establecimientos ge
    JOIN public.establecimientos est ON est.id = ge.establecimiento_id
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE ge.id = (p_row->>'gestion_establecimiento_id')::uuid;
    RETURN v_cid;
  END IF;

  -- gestiones_observaciones → gestiones_registros → gestiones_establecimientos → …
  IF p_row ? 'registro_gestion_id' AND p_row->>'registro_gestion_id' IS NOT NULL THEN
    SELECT e.consultora_id INTO v_cid
    FROM public.gestiones_registros gr
    JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
    JOIN public.establecimientos est ON est.id = ge.establecimiento_id
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE gr.id = (p_row->>'registro_gestion_id')::uuid;
    RETURN v_cid;
  END IF;

  RETURN NULL;
END;
$$;

-- ── 2. Colgar el trigger de auditoría en los nombres REALES ──────────────────
-- gestiones_registros es PARTICIONADA: el trigger row-level se crea en el parent y
-- PostgreSQL lo cascadea a todas las particiones automáticamente (PG11+).
DO $$
DECLARE
  t       text;
  tablas  text[] := ARRAY[
    'gestiones_registros',        -- recorridas (núcleo)
    'gestiones_observaciones',    -- observaciones (núcleo)
    'gestiones_establecimientos', -- vínculo gestión↔establecimiento + firmada
    'firmas',                     -- firmas (prueba de quién firmó)
    'gestiones'                   -- catálogo de tipos (cae en cadena global, sin tenant)
  ];
  has_id  boolean;
  rel_ok  boolean;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    ) INTO rel_ok;
    IF NOT rel_ok THEN
      RAISE NOTICE 'audit cobertura: tabla % no existe — skip', t;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='id'
    ) INTO has_id;
    IF NOT has_id THEN
      RAISE NOTICE 'audit cobertura: tabla % sin columna id — skip', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$I ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_%1$I AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger()',
      t
    );
    RAISE NOTICE 'audit cobertura: trigger creado en %', t;
  END LOOP;
END;
$$;
