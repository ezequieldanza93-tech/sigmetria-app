-- ============================================================
-- Sigmetría HyS — Autocontrol (Prompt 5, Res. SRT 48/2025 Art. 4.9)
-- Migración 2/2: detección de inconsistencias + alertas tempranas
--                configurables + supervisión del mecanismo (cron) +
--                vista consolidada de estado de cumplimiento.
-- ============================================================
--
-- CONTENIDO:
--   1. alertas_umbrales          → umbrales de aviso ANTES del vencimiento,
--                                  configurables por consultora (default 30/15/7).
--   2. alertas_emitidas_log      → registro inmutable de cada alerta/aviso emitido
--                                  (qué, a quién, cuándo, canal) — supervisión.
--   3. cron_jobs_log             → bitácora de cada corrida de cron (cuándo corrió,
--                                  estado, filas, resultado) — demuestra que el
--                                  autocontrol funciona ante un auditor.
--   4. fn_detectar_inconsistencias(consultora) → TODAS las reglas de inconsistencia
--                                  definidas en UN SOLO LUGAR, fáciles de extender.
--   5. vw_estado_cumplimiento    → indicadores consolidados por empresa
--                                  (vencimientos, inconsistencias, avance ISO 45001).
--   6. FIX generar_alertas_consultora → la función vigente referenciaba la tabla
--                                  `siniestros`, RENOMBRADA a `incidentes` en
--                                  20260614000002. Hoy esa función FALLA. Se
--                                  reescribe contra `incidentes`. (Ver decisiones.)
--
-- ADITIVA. Idempotente.
-- ✅ APLICADA A PRODUCCIÓN 2026-06-11 (run GitHub Actions 27368883915; cadena INTEGRA + escritura OK).
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- 1. UMBRALES DE ALERTA TEMPRANA (configurables, anti-spam)
-- ════════════════════════════════════════════════════════════
-- Por qué una tabla aparte y no extender configuracion_vencimientos:
-- los `dias_aviso` de configuracion_vencimientos generan NOTIFICACIONES in-app
-- por TIPO de entidad (10/3/0 hoy). Los umbrales tempranos son una capa de
-- ESCALAMIENTO previa (ej. 30/15/7) que aplica transversalmente y puede tener
-- su propia severidad. Separar evita acoplar dos conceptos distintos.
CREATE TABLE IF NOT EXISTS public.alertas_umbrales (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id  uuid        NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  dias_antes     integer     NOT NULL CHECK (dias_antes > 0),
  severidad      text        NOT NULL DEFAULT 'info' CHECK (severidad IN ('info','warning','critical')),
  activo         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultora_id, dias_antes)
);

CREATE INDEX IF NOT EXISTS idx_alertas_umbrales_consultora
  ON public.alertas_umbrales (consultora_id) WHERE activo;

ALTER TABLE public.alertas_umbrales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_umbrales: select" ON public.alertas_umbrales;
CREATE POLICY "alertas_umbrales: select" ON public.alertas_umbrales FOR SELECT TO authenticated
  USING (public.is_member_of_consultora(consultora_id));

-- Escritura solo full_access_main (config de la consultora) o super admin.
DROP POLICY IF EXISTS "alertas_umbrales: write" ON public.alertas_umbrales;
CREATE POLICY "alertas_umbrales: write" ON public.alertas_umbrales FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.get_consultora_role(consultora_id) = 'full_access_main')
  WITH CHECK (public.is_super_admin() OR public.get_consultora_role(consultora_id) = 'full_access_main');

COMMENT ON TABLE public.alertas_umbrales IS
  'Umbrales de alerta temprana ANTES del vencimiento (ej. 30/15/7 días), configurables por consultora. Capa de escalamiento previa a las notificaciones in-app 10/3/0.';

-- Seed: default 30/15/7 para consultoras existentes (idempotente por UNIQUE).
INSERT INTO public.alertas_umbrales (consultora_id, dias_antes, severidad)
SELECT c.id, u.dias, u.sev
FROM public.consultoras c
CROSS JOIN (VALUES (30,'info'), (15,'warning'), (7,'critical')) AS u(dias, sev)
ON CONFLICT (consultora_id, dias_antes) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 2. REGISTRO DE ALERTAS EMITIDAS (supervisión — qué/a quién/cuándo)
-- ════════════════════════════════════════════════════════════
-- Inmutable a nivel app: solo el código server (service_role) inserta; nadie
-- edita ni borra. Sirve para demostrar ante el auditor que el aviso SE EMITIÓ.
CREATE TABLE IF NOT EXISTS public.alertas_emitidas_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id   uuid        NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  canal           text        NOT NULL CHECK (canal IN ('in_app','email')),
  tipo            text        NOT NULL,                 -- 'vencimiento' | 'alerta_srt' | 'inconsistencia' | alerta_tipo
  severidad       text,                                 -- info|warning|critical (si aplica)
  destinatarios   text[]      NOT NULL DEFAULT '{}',    -- emails (email) o vacío (in_app: visible a la consultora)
  cantidad        integer     NOT NULL DEFAULT 1,       -- cuántos ítems agrupó este envío (anti-spam)
  referencia_tipo text,                                 -- entidad referida (ej. 'empresas_documentos')
  referencia_id   uuid,
  meta            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  emitida_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_emitidas_consultora
  ON public.alertas_emitidas_log (consultora_id, emitida_at DESC);

ALTER TABLE public.alertas_emitidas_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_emitidas: select" ON public.alertas_emitidas_log;
CREATE POLICY "alertas_emitidas: select" ON public.alertas_emitidas_log FOR SELECT TO authenticated
  USING (public.is_member_of_consultora(consultora_id) OR public.is_super_admin());

-- INSERT/UPDATE/DELETE: bloqueados para usuarios. service_role bypasea RLS.
DROP POLICY IF EXISTS "alertas_emitidas: no_write" ON public.alertas_emitidas_log;
CREATE POLICY "alertas_emitidas: no_write" ON public.alertas_emitidas_log FOR INSERT TO authenticated
  WITH CHECK (false);

COMMENT ON TABLE public.alertas_emitidas_log IS
  'Bitácora inmutable de cada alerta/aviso emitido (canal, destinatarios, agrupación). Escrito solo por el server (service_role). Evidencia de autocontrol Art. 4.9.';

-- ════════════════════════════════════════════════════════════
-- 3. BITÁCORA DE CRON (supervisión del propio mecanismo)
-- ════════════════════════════════════════════════════════════
-- Cada corrida de cualquier cron route escribe una fila acá (start → finish).
-- Demuestra que el job corrió, cuándo, y con qué resultado.
CREATE TABLE IF NOT EXISTS public.cron_jobs_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      text        NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text        NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  error         text,
  filas_procesadas integer,
  -- contadores específicos del autocontrol (cualquiera puede ser NULL si no aplica):
  notificaciones_generadas integer,
  alertas_generadas        integer,
  inconsistencias_detectadas integer,
  resultado     jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_job
  ON public.cron_jobs_log (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_started
  ON public.cron_jobs_log (started_at DESC);

ALTER TABLE public.cron_jobs_log ENABLE ROW LEVEL SECURITY;

-- Solo super admin lee la bitácora completa (es transversal a todas las consultoras).
DROP POLICY IF EXISTS "cron_jobs_log: select" ON public.cron_jobs_log;
CREATE POLICY "cron_jobs_log: select" ON public.cron_jobs_log FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "cron_jobs_log: no_write" ON public.cron_jobs_log;
CREATE POLICY "cron_jobs_log: no_write" ON public.cron_jobs_log FOR INSERT TO authenticated
  WITH CHECK (false);

COMMENT ON TABLE public.cron_jobs_log IS
  'Bitácora de corridas de cron (autocontrol). Escrita por cada route de cron vía service_role. Demuestra que el mecanismo de supervisión funciona (Art. 4.9).';

-- Helpers para abrir/cerrar una corrida desde el server (SECURITY DEFINER →
-- se pueden llamar incluso si en el futuro se restringe el INSERT directo).
CREATE OR REPLACE FUNCTION public.cron_log_start(p_job_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.cron_jobs_log (job_name, status)
  VALUES (p_job_name, 'running')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cron_log_finish(
  p_id uuid,
  p_status text,
  p_error text DEFAULT NULL,
  p_filas integer DEFAULT NULL,
  p_resultado jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cron_jobs_log
  SET finished_at = now(),
      status = p_status,
      error = p_error,
      filas_procesadas = p_filas,
      notificaciones_generadas   = COALESCE((p_resultado->>'notificaciones')::int, notificaciones_generadas),
      alertas_generadas          = COALESCE((p_resultado->>'alertas')::int, alertas_generadas),
      inconsistencias_detectadas = COALESCE((p_resultado->>'inconsistencias')::int, inconsistencias_detectadas),
      resultado = p_resultado
  WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cron_log_start(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cron_log_finish(uuid, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_log_start(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_log_finish(uuid, text, text, integer, jsonb) TO service_role;

-- ════════════════════════════════════════════════════════════
-- 4. DETECCIÓN DE INCONSISTENCIAS — REGLAS EN UN SOLO LUGAR
-- ════════════════════════════════════════════════════════════
-- Devuelve un conjunto de inconsistencias de cumplimiento para una consultora.
-- CÓMO EXTENDER: agregá un bloque `RETURN QUERY` nuevo siguiendo el patrón
-- (codigo, severidad, mensaje). El `codigo` identifica la regla; el resto del
-- sistema (panel, log) NO necesita cambios. Cada regla está numerada y comentada.
DROP FUNCTION IF EXISTS public.fn_detectar_inconsistencias(uuid);
CREATE OR REPLACE FUNCTION public.fn_detectar_inconsistencias(p_consultora_id uuid)
RETURNS TABLE (
  codigo            text,    -- identificador estable de la regla
  severidad         text,    -- info | warning | critical
  empresa_id        uuid,
  establecimiento_id uuid,
  referencia_tabla  text,
  referencia_id     uuid,
  mensaje           text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── REGLA I1: inspección/recorrida realizada SIN reporte generado ──────────
  -- Una inspección marcada 'realizada' o 'con_observaciones' debería tener un
  -- reporte. Como no hay FK inspeccion→reporte, el criterio "sin reporte" es:
  -- no existe ningún reporte_fotografico para el mismo establecimiento con
  -- período que cubra la fecha de realización. Conservador (warning).
  RETURN QUERY
  SELECT
    'inspeccion_sin_reporte'::text,
    'warning'::text,
    e.id,
    i.establecimiento_id,
    'inspecciones'::text,
    i.id,
    'Inspección realizada el ' || to_char(i.fecha_realizada, 'DD/MM/YYYY')
      || ' sin reporte fotográfico asociado.'
  FROM public.inspecciones i
  JOIN public.establecimientos est ON est.id = i.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND i.estado IN ('realizada', 'con_observaciones')
    AND i.fecha_realizada IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.reportes_fotograficos rf
      WHERE rf.establecimiento_id = i.establecimiento_id
        AND rf.deleted_at IS NULL
        AND COALESCE(rf.periodo_desde, rf.created_at::date) <= i.fecha_realizada
        AND COALESCE(rf.periodo_hasta, rf.created_at::date) >= i.fecha_realizada
    );

  -- ── REGLA I2: documento vencido SIN renovación cargada ─────────────────────
  -- Un documento (empresa/establecimiento) cuyo vencimiento ya pasó y NO existe
  -- otro documento del MISMO tipo y entidad con vencimiento posterior (renovación).
  -- empresas_documentos
  RETURN QUERY
  SELECT
    'documento_vencido_sin_renovacion'::text,
    'critical'::text,
    ed.empresa_id,
    NULL::uuid,
    'empresas_documentos'::text,
    ed.id,
    'Documento ''' || COALESCE(dt.nombre,'(sin tipo)') || ''' venció el '
      || to_char(ed.fecha_vencimiento,'DD/MM/YYYY') || ' y no hay renovación cargada.'
  FROM public.empresas_documentos ed
  JOIN public.empresas e ON e.id = ed.empresa_id
  LEFT JOIN public.documentos_tipos dt ON dt.id = ed.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND ed.fecha_vencimiento IS NOT NULL
    AND ed.fecha_vencimiento < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM public.empresas_documentos ed2
      WHERE ed2.empresa_id = ed.empresa_id
        AND ed2.tipo_id = ed.tipo_id
        AND ed2.id <> ed.id
        AND (ed2.fecha_vencimiento IS NULL OR ed2.fecha_vencimiento > ed.fecha_vencimiento)
    );

  -- establecimientos_documentos
  RETURN QUERY
  SELECT
    'documento_vencido_sin_renovacion'::text,
    'critical'::text,
    e.id,
    esd.establecimiento_id,
    'establecimientos_documentos'::text,
    esd.id,
    'Documento ''' || COALESCE(dt.nombre,'(sin tipo)') || ''' venció el '
      || to_char(esd.fecha_vencimiento,'DD/MM/YYYY') || ' y no hay renovación cargada.'
  FROM public.establecimientos_documentos esd
  JOIN public.establecimientos est ON est.id = esd.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  LEFT JOIN public.documentos_tipos dt ON dt.id = esd.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND esd.fecha_vencimiento IS NOT NULL
    AND esd.fecha_vencimiento < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM public.establecimientos_documentos esd2
      WHERE esd2.establecimiento_id = esd.establecimiento_id
        AND esd2.tipo_id = esd.tipo_id
        AND esd2.id <> esd.id
        AND (esd2.fecha_vencimiento IS NULL OR esd2.fecha_vencimiento > esd.fecha_vencimiento)
    );

  -- ── REGLA I3: observación con fecha planificada pasada SIN cierre ───────────
  -- (seguimiento de observaciones de gestiones / reportes fotográficos).
  RETURN QUERY
  SELECT
    'observacion_vencida_sin_seguimiento'::text,
    'warning'::text,
    e.id,
    ge.establecimiento_id,
    'gestiones_observaciones'::text,
    og.id,
    'Observación planificada para el ' || to_char(og.fecha_planificada,'DD/MM/YYYY')
      || ' sigue sin cierre/seguimiento.'
  FROM public.gestiones_observaciones og
  JOIN public.gestiones_registros rg ON rg.id = og.registro_gestion_id
  JOIN public.gestiones_establecimientos ge ON ge.id = rg.gestion_establecimiento_id
  JOIN public.establecimientos est ON est.id = ge.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND og.fecha_cierre IS NULL
    AND og.fecha_planificada < CURRENT_DATE;

  -- ── REGLA I4: gestión con entregable planificada/vencida y NO ejecutada ─────
  -- gestiones_registros sin fecha_ejecutada cuya fecha planificada ya pasó,
  -- de una gestión que produce entregable (tiene_entregable = true).
  RETURN QUERY
  SELECT
    'gestion_no_ejecutada'::text,
    'warning'::text,
    e.id,
    ge.establecimiento_id,
    'gestiones_registros'::text,
    rg.id,
    'Gestión ''' || COALESCE(g.nombre,'(sin nombre)') || ''' planificada para el '
      || to_char(rg.fecha_planificada,'DD/MM/YYYY') || ' no fue ejecutada.'
  FROM public.gestiones_registros rg
  JOIN public.gestiones_establecimientos ge ON ge.id = rg.gestion_establecimiento_id
  JOIN public.gestiones g ON g.id = ge.gestion_id
  JOIN public.establecimientos est ON est.id = ge.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND g.tiene_entregable = true
    AND rg.fecha_ejecutada IS NULL
    AND rg.fecha_planificada < CURRENT_DATE;

  -- ── REGLA I5: riesgo crítico sin resolver ──────────────────────────────────
  RETURN QUERY
  SELECT
    'riesgo_critico_sin_resolver'::text,
    'critical'::text,
    e.id,
    r.establecimiento_id,
    'riesgos'::text,
    r.id,
    'Riesgo crítico sin resolver desde el ' || to_char(r.fecha_identificacion,'DD/MM/YYYY')
      || ': ' || left(r.descripcion, 120)
  FROM public.riesgos r
  JOIN public.establecimientos est ON est.id = r.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND r.nivel = 'critico'
    AND r.resuelto = false;

  -- ── REGLA I6: incidente sin cerrar pasados 30 días de la ocurrencia ─────────
  -- (incidentes = ex-siniestros; estado enum 'pendiente'|'en_investigacion'|'cerrado')
  RETURN QUERY
  SELECT
    'incidente_sin_cerrar'::text,
    'critical'::text,
    e.id,
    i.establecimiento_id,
    'incidentes'::text,
    i.id,
    'Incidente abierto hace más de 30 días sin resolución (ocurrió el '
      || to_char(i.fecha_ocurrencia,'DD/MM/YYYY') || ').'
  FROM public.incidentes i
  JOIN public.establecimientos est ON est.id = i.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND i.estado IN ('pendiente','en_investigacion')
    AND i.fecha_ocurrencia < now() - interval '30 days';

  -- >>> NUEVAS REGLAS: agregá acá otro bloque RETURN QUERY siguiendo el patrón.

END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_detectar_inconsistencias(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_detectar_inconsistencias(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_detectar_inconsistencias(uuid) IS
  'Autocontrol Art. 4.9: detecta inconsistencias de cumplimiento de una consultora. TODAS las reglas viven acá (UN solo lugar). Extender = agregar un RETURN QUERY.';

-- ════════════════════════════════════════════════════════════
-- 5. VISTA CONSOLIDADA — ESTADO DE CUMPLIMIENTO POR EMPRESA
-- ════════════════════════════════════════════════════════════
-- Consolida por empresa: vencimientos próximos (<=30d), vencidos, alertas
-- abiertas, e indicador ISO 45001 (cuántos establecimientos lo aplican).
-- Vista (no materializada): siempre fresca; el volumen por consultora es chico.
CREATE OR REPLACE VIEW public.vw_estado_cumplimiento
WITH (security_invoker = true) AS
WITH docs AS (
  -- documentos de empresa
  SELECT e.id AS empresa_id, e.consultora_id, ed.fecha_vencimiento
  FROM public.empresas_documentos ed
  JOIN public.empresas e ON e.id = ed.empresa_id
  WHERE ed.fecha_vencimiento IS NOT NULL
  UNION ALL
  -- documentos de establecimiento (atribuidos a su empresa)
  SELECT e.id AS empresa_id, e.consultora_id, esd.fecha_vencimiento
  FROM public.establecimientos_documentos esd
  JOIN public.establecimientos est ON est.id = esd.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE esd.fecha_vencimiento IS NOT NULL
),
docs_agg AS (
  SELECT empresa_id, consultora_id,
    count(*) FILTER (WHERE fecha_vencimiento < CURRENT_DATE) AS docs_vencidos,
    count(*) FILTER (WHERE fecha_vencimiento >= CURRENT_DATE
                       AND fecha_vencimiento <= CURRENT_DATE + interval '30 days') AS docs_por_vencer
  FROM docs
  GROUP BY empresa_id, consultora_id
),
alertas_agg AS (
  SELECT empresa_id,
    count(*) FILTER (WHERE NOT resuelta) AS alertas_abiertas,
    count(*) FILTER (WHERE NOT resuelta AND severidad = 'critical') AS alertas_criticas
  FROM public.alertas
  GROUP BY empresa_id
),
iso_agg AS (
  SELECT est.empresa_id,
    count(*) AS estab_total,
    count(*) FILTER (WHERE est.aplica_iso_45001) AS estab_iso
  FROM public.establecimientos est
  GROUP BY est.empresa_id
)
SELECT
  e.id                                   AS empresa_id,
  e.consultora_id,
  e.razon_social,
  COALESCE(d.docs_vencidos, 0)           AS docs_vencidos,
  COALESCE(d.docs_por_vencer, 0)         AS docs_por_vencer,
  COALESCE(a.alertas_abiertas, 0)        AS alertas_abiertas,
  COALESCE(a.alertas_criticas, 0)        AS alertas_criticas,
  COALESCE(i.estab_total, 0)             AS establecimientos_total,
  COALESCE(i.estab_iso, 0)               AS establecimientos_iso,
  CASE WHEN COALESCE(i.estab_total,0) > 0
       THEN round(COALESCE(i.estab_iso,0)::numeric / i.estab_total * 100, 0)
       ELSE 0 END                        AS iso_cobertura_pct
FROM public.empresas e
LEFT JOIN docs_agg    d ON d.empresa_id = e.id
LEFT JOIN alertas_agg a ON a.empresa_id = e.id
LEFT JOIN iso_agg     i ON i.empresa_id = e.id;

COMMENT ON VIEW public.vw_estado_cumplimiento IS
  'Estado de cumplimiento consolidado por empresa: vencimientos, alertas abiertas y cobertura ISO 45001. security_invoker → respeta RLS de las tablas base.';

GRANT SELECT ON public.vw_estado_cumplimiento TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════
-- 6. FIX: generar_alertas_consultora contra `incidentes` (ex-siniestros)
-- ════════════════════════════════════════════════════════════
-- La versión de 20260527000004 referenciaba public.siniestros, RENOMBRADA a
-- public.incidentes (20260614000002). Hoy la función FALLA con "relation
-- siniestros does not exist". Acá se reescribe idéntica salvo esos dos bloques.
-- El estado de incidentes usa el enum incidente_estado: pendiente/en_investigacion/cerrado.
-- El campo de fecha es fecha_ocurrencia (conservado en el rename).
CREATE OR REPLACE FUNCTION public.generar_alertas_consultora(p_consultora_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_rows  integer := 0;
BEGIN
  DELETE FROM public.alertas
  WHERE consultora_id = p_consultora_id
    AND resuelta = false;

  -- documento_por_vencer (empresa)
  INSERT INTO public.alertas
    (consultora_id, empresa_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT e.consultora_id, ed.empresa_id, 'documento_por_vencer', 'warning',
    'El documento ''' || COALESCE(dt.nombre,'sin nombre') || ''' vence el ' || to_char(ed.fecha_vencimiento,'DD/MM/YYYY'),
    'empresas_documentos', ed.id
  FROM public.empresas_documentos ed
  JOIN public.empresas e ON e.id = ed.empresa_id
  JOIN public.documentos_tipos dt ON dt.id = ed.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND ed.fecha_vencimiento IS NOT NULL
    AND ed.fecha_vencimiento >= CURRENT_DATE
    AND ed.fecha_vencimiento <= CURRENT_DATE + interval '30 days';
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total := v_total + v_rows;

  -- documento_por_vencer (establecimiento)
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT e.consultora_id, e.id, esd.establecimiento_id, 'documento_por_vencer', 'warning',
    'El documento ''' || COALESCE(dt.nombre,'sin nombre') || ''' vence el ' || to_char(esd.fecha_vencimiento,'DD/MM/YYYY'),
    'establecimientos_documentos', esd.id
  FROM public.establecimientos_documentos esd
  JOIN public.establecimientos est ON est.id = esd.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  JOIN public.documentos_tipos dt ON dt.id = esd.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND esd.fecha_vencimiento IS NOT NULL
    AND esd.fecha_vencimiento >= CURRENT_DATE
    AND esd.fecha_vencimiento <= CURRENT_DATE + interval '30 days';
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total := v_total + v_rows;

  -- documento_vencido (empresa)
  INSERT INTO public.alertas
    (consultora_id, empresa_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT e.consultora_id, ed.empresa_id, 'documento_vencido', 'critical',
    'El documento ''' || COALESCE(dt.nombre,'sin nombre') || ''' venció el ' || to_char(ed.fecha_vencimiento,'DD/MM/YYYY'),
    'empresas_documentos', ed.id
  FROM public.empresas_documentos ed
  JOIN public.empresas e ON e.id = ed.empresa_id
  JOIN public.documentos_tipos dt ON dt.id = ed.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND ed.fecha_vencimiento IS NOT NULL
    AND ed.fecha_vencimiento < CURRENT_DATE;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total := v_total + v_rows;

  -- documento_vencido (establecimiento)
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT e.consultora_id, e.id, esd.establecimiento_id, 'documento_vencido', 'critical',
    'El documento ''' || COALESCE(dt.nombre,'sin nombre') || ''' venció el ' || to_char(esd.fecha_vencimiento,'DD/MM/YYYY'),
    'establecimientos_documentos', esd.id
  FROM public.establecimientos_documentos esd
  JOIN public.establecimientos est ON est.id = esd.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  JOIN public.documentos_tipos dt ON dt.id = esd.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND esd.fecha_vencimiento IS NOT NULL
    AND esd.fecha_vencimiento < CURRENT_DATE;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total := v_total + v_rows;

  -- siniestro_sin_investigar  → incidentes pendientes hace > 72h
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT e.consultora_id, e.id, i.establecimiento_id, 'siniestro_sin_investigar', 'warning',
    'Incidente sin investigar desde hace más de 72hs', 'incidentes', i.id
  FROM public.incidentes i
  JOIN public.establecimientos est ON est.id = i.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND i.estado = 'pendiente'
    AND i.fecha_ocurrencia < now() - interval '72 hours';
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total := v_total + v_rows;

  -- siniestro_sin_cerrar  → incidentes abiertos hace > 30 días
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT e.consultora_id, e.id, i.establecimiento_id, 'siniestro_sin_cerrar', 'critical',
    'Incidente abierto hace más de 30 días sin resolución', 'incidentes', i.id
  FROM public.incidentes i
  JOIN public.establecimientos est ON est.id = i.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND i.estado IN ('pendiente','en_investigacion')
    AND i.fecha_ocurrencia < now() - interval '30 days';
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total := v_total + v_rows;

  -- capacitacion_no_realizada
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT e.consultora_id, c.empresa_id, c.establecimiento_id, 'capacitacion_no_realizada', 'warning',
    'La capacitación ''' || c.titulo || ''' no fue marcada como realizada', 'capacitaciones', c.id
  FROM public.capacitaciones c
  JOIN public.empresas e ON e.id = c.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND c.estado = 'programada'
    AND c.fecha_programada < CURRENT_DATE;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total := v_total + v_rows;

  -- riesgo_critico_activo
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT e.consultora_id, e.id, r.establecimiento_id, 'riesgo_critico_activo', 'critical',
    'Riesgo crítico sin resolver: ' || r.descripcion, 'riesgos', r.id
  FROM public.riesgos r
  JOIN public.establecimientos est ON est.id = r.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND r.nivel = 'critico'
    AND r.resuelto = false;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_total := v_total + v_rows;

  RETURN v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_alertas_consultora(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generar_alertas_consultora(uuid) TO service_role;

COMMIT;
