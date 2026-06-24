-- ============================================================
-- Firma del TRABAJADOR sobre la entrega de EPP + constancia (validez legal)
-- ============================================================
-- GAP que cierra esta migración: la tabla entregas_epp ya tiene firma_id y el
-- enum firmas.entidad_tipo ya incluye 'entrega_epp', pero NADIE capturaba la
-- firma. El trabajador NO es miembro de consultoras_members, así que la RLS de
-- INSERT de `firmas` lo bloquea. Por eso la firma del trabajador se hace por una
-- RPC SECURITY DEFINER que valida la propiedad por persona.user_id (igual patrón
-- que responder_item_entrega_epp).
--
-- Reglas de negocio del acto de firma:
--   * Solo el trabajador dueño (personas_directorio.user_id = auth.uid()) firma.
--   * Antes de firmar, TODOS los ítems deben estar respondidos (conforme/observado).
--     La firma es el cierre del acto: sella la conformidad/descargo ya emitidos.
--   * La firma queda en `firmas` (entidad_tipo='entrega_epp', firmante_tipo='trabajador',
--     trabajador_id=persona) y se enlaza en entregas_epp.firma_id. Ambas tablas ya
--     están auditadas con hash encadenado por consultora (fn_audit_trigger).
--   * geo-sello opcional del dispositivo del trabajador al firmar.
--
-- También: mis_entregas_epp() ahora devuelve firma_svg_data + geo + entregado_por
-- (para que el trabajador y la constancia PDF tengan todo el contexto), y se agrega
-- entregas_epp_staff() para que el profesional liste el historial con la firma.
--
-- Migración ADITIVA. No toca migraciones aplicadas.
-- ============================================================

BEGIN;

-- ── RPC: el trabajador firma su entrega ───────────────────────────────────────
-- SECURITY DEFINER: bypassa la RLS de `firmas` (el trabajador no es miembro de la
-- consultora) pero enforce la propiedad por persona.user_id. Atómica: inserta la
-- firma, enlaza firma_id y deja constancia del geo-sello. Idempotente: si ya hay
-- firma, la reemplaza (re-firma) en vez de duplicar.
-- p_nombre/p_dni/p_rol son OPCIONALES: el trabajador NO puede leer su propia fila
-- de personas_directorio (la RLS de SELECT solo habilita a miembros de la
-- consultora), así que el snapshot del firmante lo resuelve esta función
-- SECURITY DEFINER desde la persona dueña. Si el cliente igual los manda, ganan.
CREATE OR REPLACE FUNCTION public.firmar_entrega_epp(
  p_entrega_id     uuid,
  p_firma_svg      text,
  p_nombre         text DEFAULT NULL,
  p_dni            text DEFAULT NULL,
  p_rol            text DEFAULT NULL,
  p_geo_lat        double precision DEFAULT NULL,
  p_geo_lng        double precision DEFAULT NULL,
  p_geo_precision  double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultora  uuid;
  v_persona     uuid;
  v_pd_nombre   text;
  v_pd_dni      text;
  v_total       int;
  v_pendientes  int;
  v_firma_prev  uuid;
  v_firma_id    uuid;
  v_nombre      text;
  v_dni         text;
BEGIN
  IF p_firma_svg IS NULL OR length(trim(p_firma_svg)) = 0 THEN
    RAISE EXCEPTION 'La firma es obligatoria';
  END IF;

  -- Propiedad: la entrega debe ser de la persona del directorio vinculada al usuario.
  SELECT ee.consultora_id, ee.persona_id, ee.firma_id,
         trim(concat_ws(' ', pd.nombre, pd.apellido)), pd.dni
    INTO v_consultora, v_persona, v_firma_prev, v_pd_nombre, v_pd_dni
  FROM public.entregas_epp ee
  JOIN public.personas_directorio pd
    ON pd.id = ee.persona_id AND pd.user_id = (SELECT auth.uid())
  WHERE ee.id = p_entrega_id;

  IF v_consultora IS NULL THEN
    RAISE EXCEPTION 'No podés firmar esta entrega (no es tuya o no existe)';
  END IF;

  v_nombre := NULLIF(trim(coalesce(p_nombre, '')), '');
  IF v_nombre IS NULL THEN v_nombre := NULLIF(v_pd_nombre, ''); END IF;
  v_dni := NULLIF(trim(coalesce(p_dni, '')), '');
  IF v_dni IS NULL THEN v_dni := v_pd_dni; END IF;

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver el nombre del firmante';
  END IF;
  IF v_dni IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver el DNI del firmante';
  END IF;

  -- Todos los ítems deben estar respondidos antes de firmar.
  SELECT count(*), count(*) FILTER (WHERE respondido_at IS NULL)
    INTO v_total, v_pendientes
  FROM public.entregas_epp_items WHERE entrega_id = p_entrega_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'La entrega no tiene elementos para firmar';
  END IF;
  IF v_pendientes > 0 THEN
    RAISE EXCEPTION 'Antes de firmar tenés que responder todos los elementos (conforme u observado)';
  END IF;

  -- Re-firma: si ya había una firma, la borramos (queda en el audit_log el DELETE).
  IF v_firma_prev IS NOT NULL THEN
    DELETE FROM public.firmas WHERE id = v_firma_prev;
  END IF;

  INSERT INTO public.firmas (
    consultora_id, entidad_tipo, entidad_id, firmante_tipo,
    trabajador_id, nombre_completo, dni, rol, firma_svg_data, asistente_id
  ) VALUES (
    v_consultora, 'entrega_epp', p_entrega_id, 'trabajador',
    v_persona, v_nombre, v_dni, NULLIF(trim(coalesce(p_rol, '')), ''),
    p_firma_svg,
    -- asistente: el propio trabajador (firma autónoma desde su cuenta + MFA).
    (SELECT auth.uid())
  )
  RETURNING id INTO v_firma_id;

  UPDATE public.entregas_epp
  SET firma_id        = v_firma_id,
      respondida_at   = coalesce(respondida_at, now()),
      geo_lat         = coalesce(p_geo_lat, geo_lat),
      geo_lng         = coalesce(p_geo_lng, geo_lng),
      geo_precision_m = coalesce(p_geo_precision, geo_precision_m),
      geo_captured_at = CASE WHEN p_geo_lat IS NOT NULL THEN now() ELSE geo_captured_at END,
      updated_at      = now()
  WHERE id = p_entrega_id;

  RETURN v_firma_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.firmar_entrega_epp(uuid, text, text, text, text, double precision, double precision, double precision) TO authenticated;

-- ── mis_entregas_epp(): ahora incluye firma + geo + entregado_por ─────────────
-- (reemplaza la versión previa; misma firma sin args → upsert seguro)
CREATE OR REPLACE FUNCTION public.mis_entregas_epp()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(e ORDER BY e.fecha_entrega DESC, e.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      ee.id, ee.fecha_entrega, ee.estado, ee.observaciones,
      ee.respondida_at, ee.firma_id, ee.created_at,
      ee.entregado_por_nombre,
      ee.geo_lat, ee.geo_lng, ee.geo_captured_at,
      est.nombre       AS establecimiento_nombre,
      emp.razon_social AS empresa_nombre,
      f.firma_svg_data AS firma_svg_data,
      f.created_at     AS firma_at,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', it.id,
          'producto_nombre', it.producto_nombre,
          'talle', it.talle,
          'cantidad', it.cantidad,
          'conformidad', it.conformidad,
          'descargo', it.descargo,
          'respondido_at', it.respondido_at
        ) ORDER BY it.created_at), '[]'::jsonb)
        FROM public.entregas_epp_items it WHERE it.entrega_id = ee.id
      ) AS items
    FROM public.entregas_epp ee
    JOIN public.personas_directorio pd
      ON pd.id = ee.persona_id AND pd.user_id = (SELECT auth.uid())
    LEFT JOIN public.establecimientos est ON est.id = ee.establecimiento_id
    LEFT JOIN public.empresas emp          ON emp.id = est.empresa_id
    LEFT JOIN public.firmas f              ON f.id = ee.firma_id
  ) e;
$$;
GRANT EXECUTE ON FUNCTION public.mis_entregas_epp() TO authenticated;

-- ── entregas_epp_staff(): historial para el profesional (miembro de la consultora) ──
-- SECURITY INVOKER (default): respeta la RLS de SELECT de entregas_epp (miembros de
-- la consultora). Devuelve cada entrega con persona, establecimiento/empresa, firma
-- y sus ítems. Filtros opcionales por establecimiento, persona y estado.
CREATE OR REPLACE FUNCTION public.entregas_epp_staff(
  p_establecimiento_id uuid DEFAULT NULL,
  p_persona_id         uuid DEFAULT NULL,
  p_estado             text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(e ORDER BY e.fecha_entrega DESC, e.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      ee.id, ee.fecha_entrega, ee.estado, ee.observaciones,
      ee.respondida_at, ee.firma_id, ee.created_at,
      ee.entregado_por_nombre, ee.establecimiento_id, ee.persona_id,
      ee.geo_lat, ee.geo_lng, ee.geo_captured_at,
      pd.nombre        AS persona_nombre,
      pd.apellido      AS persona_apellido,
      pd.dni           AS persona_dni,
      est.nombre       AS establecimiento_nombre,
      emp.razon_social AS empresa_nombre,
      (f.id IS NOT NULL) AS firmada,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', it.id,
          'producto_nombre', it.producto_nombre,
          'talle', it.talle,
          'cantidad', it.cantidad,
          'conformidad', it.conformidad,
          'descargo', it.descargo,
          'respondido_at', it.respondido_at
        ) ORDER BY it.created_at), '[]'::jsonb)
        FROM public.entregas_epp_items it WHERE it.entrega_id = ee.id
      ) AS items
    FROM public.entregas_epp ee
    JOIN public.personas_directorio pd ON pd.id = ee.persona_id
    LEFT JOIN public.establecimientos est ON est.id = ee.establecimiento_id
    LEFT JOIN public.empresas emp          ON emp.id = est.empresa_id
    LEFT JOIN public.firmas f              ON f.id = ee.firma_id
    WHERE (p_establecimiento_id IS NULL OR ee.establecimiento_id = p_establecimiento_id)
      AND (p_persona_id         IS NULL OR ee.persona_id = p_persona_id)
      AND (p_estado             IS NULL OR ee.estado = p_estado)
  ) e;
$$;
GRANT EXECUTE ON FUNCTION public.entregas_epp_staff(uuid, uuid, text) TO authenticated;

-- ── entrega_epp_constancia(id): payload completo para la constancia PDF (staff) ──
-- SECURITY INVOKER: respeta la RLS (miembro de la consultora). Devuelve el
-- encabezado + ítems + firma del trabajador para que el front arme el PDF con el
-- report-kit. El establecimiento_id se usa para resolver el branding (logos/firma).
CREATE OR REPLACE FUNCTION public.entrega_epp_constancia(p_entrega_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(x)
  FROM (
    SELECT
      ee.id, ee.fecha_entrega, ee.estado, ee.observaciones,
      ee.respondida_at, ee.created_at, ee.entregado_por_nombre,
      ee.establecimiento_id, ee.persona_id,
      ee.geo_lat, ee.geo_lng, ee.geo_captured_at,
      pd.nombre   AS persona_nombre,
      pd.apellido AS persona_apellido,
      pd.dni      AS persona_dni,
      pd.legajo   AS persona_legajo,
      est.nombre  AS establecimiento_nombre,
      CASE WHEN f.id IS NOT NULL THEN jsonb_build_object(
        'nombre_completo', f.nombre_completo,
        'dni', f.dni,
        'rol', f.rol,
        'firma_svg_data', f.firma_svg_data,
        'firmada_at', f.created_at
      ) END AS firma,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', it.id,
          'producto_nombre', it.producto_nombre,
          'talle', it.talle,
          'cantidad', it.cantidad,
          'conformidad', it.conformidad,
          'descargo', it.descargo,
          'respondido_at', it.respondido_at
        ) ORDER BY it.created_at), '[]'::jsonb)
        FROM public.entregas_epp_items it WHERE it.entrega_id = ee.id
      ) AS items
    FROM public.entregas_epp ee
    JOIN public.personas_directorio pd ON pd.id = ee.persona_id
    LEFT JOIN public.establecimientos est ON est.id = ee.establecimiento_id
    LEFT JOIN public.firmas f              ON f.id = ee.firma_id
    WHERE ee.id = p_entrega_id
  ) x;
$$;
GRANT EXECUTE ON FUNCTION public.entrega_epp_constancia(uuid) TO authenticated;

COMMIT;
