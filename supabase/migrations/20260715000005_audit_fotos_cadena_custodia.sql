-- ============================================================
-- Sigmetría HyS — Cadena de custodia: cobertura tablas de fotos
-- (Art. 4.2 Res. SRT 48/2025 / Disp. 15/2026)
--
-- Problema: incidentes_fotos, denuncias_fotos,
--   reportes_fotograficos_fotos y observaciones_fotos_cliente
--   no tienen triggers de auditoría. Un INSERT/UPDATE/DELETE
--   directo sobre cualquiera de ellas NO queda registrado en
--   audit_log y queda fuera de la cadena de custodia.
--
-- Situación de fn_resolve_consultora_id:
--   Las 4 tablas de fotos NO tienen consultora_id, empresa_id
--   ni establecimiento_id directos. Tienen FKs a sus tablas
--   padre (incidente_id, denuncia_id, reporte_id, observacion_id).
--   Sin extensión del resolver, todos sus eventos caerían en la
--   cadena global (UUID cero) en vez de la cadena del tenant,
--   degradando la trazabilidad por consultora.
--
-- Esta migración:
--   1. Extiende fn_resolve_consultora_id con 4 ramas nuevas:
--      incidente_id, denuncia_id, reporte_id, observacion_id.
--   2. Adjunta el trigger fn_audit_trigger a las 4 tablas.
--
-- Aditiva e idempotente. No modifica datos ni migraciones anteriores.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Extender fn_resolve_consultora_id
--    Se preservan TODAS las ramas existentes (consultora_id,
--    empresa_id, establecimiento_id, gestion_establecimiento_id,
--    registro_gestion_id). Se agregan 4 ramas al final.
-- ============================================================
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
  -- ── Ramas originales (20260702000001 + 20260713000002) ──────

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

  -- ── Ramas nuevas: tablas de fotos ───────────────────────────

  -- incidentes_fotos → incidentes (tiene consultora_id directo)
  IF p_row ? 'incidente_id' AND p_row->>'incidente_id' IS NOT NULL THEN
    SELECT consultora_id INTO v_cid
    FROM public.incidentes
    WHERE id = (p_row->>'incidente_id')::uuid;
    RETURN v_cid;
  END IF;

  -- denuncias_fotos → denuncias (tiene consultora_id directo)
  IF p_row ? 'denuncia_id' AND p_row->>'denuncia_id' IS NOT NULL THEN
    SELECT consultora_id INTO v_cid
    FROM public.denuncias
    WHERE id = (p_row->>'denuncia_id')::uuid;
    RETURN v_cid;
  END IF;

  -- reportes_fotograficos_fotos → reportes_fotograficos (tiene consultora_id directo)
  IF p_row ? 'reporte_id' AND p_row->>'reporte_id' IS NOT NULL THEN
    SELECT consultora_id INTO v_cid
    FROM public.reportes_fotograficos
    WHERE id = (p_row->>'reporte_id')::uuid;
    RETURN v_cid;
  END IF;

  -- observaciones_fotos_cliente → gestiones_observaciones → gestiones_registros → …
  -- (gestiones_observaciones no tiene consultora_id directo; se sube por su FK
  --  registro_gestion_id, que ya resuelve la rama anterior. Aquí lo hacemos
  --  en un solo JOIN desde observacion_id para evitar doble lookup.)
  IF p_row ? 'observacion_id' AND p_row->>'observacion_id' IS NOT NULL THEN
    SELECT e.consultora_id INTO v_cid
    FROM public.gestiones_observaciones go
    JOIN public.gestiones_registros gr ON gr.id = go.registro_gestion_id
    JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
    JOIN public.establecimientos est ON est.id = ge.establecimiento_id
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE go.id = (p_row->>'observacion_id')::uuid;
    RETURN v_cid;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================
-- 2. Adjuntar el trigger de auditoría a las 4 tablas de fotos
--    Defensivo: verifica existencia de la tabla y columna id.
--    Idempotente: DROP IF EXISTS antes de CREATE.
-- ============================================================
DO $$
DECLARE
  t      text;
  tablas text[] := ARRAY[
    'incidentes_fotos',
    'denuncias_fotos',
    'reportes_fotograficos_fotos',
    'observaciones_fotos_cliente'
  ];
  has_id boolean;
  rel_ok boolean;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) INTO rel_ok;

    IF NOT rel_ok THEN
      RAISE NOTICE 'audit fotos: tabla % no existe — skip', t;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'id'
    ) INTO has_id;

    IF NOT has_id THEN
      RAISE NOTICE 'audit fotos: tabla % sin columna id — skip', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$I ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_%1$I'
      ' AFTER INSERT OR UPDATE OR DELETE ON public.%1$I'
      ' FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger()',
      t
    );
    RAISE NOTICE 'audit fotos: trigger creado en %', t;
  END LOOP;
END;
$$;

COMMIT;
