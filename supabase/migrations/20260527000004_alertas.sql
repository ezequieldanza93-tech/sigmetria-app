-- Art. 4.9 Res. SRT 48/2025 — Sistema de alertas y autocontrol
BEGIN;

-- ============================================================
-- 1. ENUMs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.alerta_severidad AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.alerta_tipo AS ENUM (
    'documento_por_vencer',
    'documento_vencido',
    'siniestro_sin_investigar',
    'siniestro_sin_cerrar',
    'capacitacion_no_realizada',
    'riesgo_critico_activo'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Tabla alertas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alertas (
  id                  uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id       uuid               NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  empresa_id          uuid               NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  establecimiento_id  uuid               REFERENCES public.establecimientos(id) ON DELETE SET NULL,
  tipo                public.alerta_tipo NOT NULL,
  severidad           public.alerta_severidad NOT NULL,
  mensaje             text               NOT NULL,
  referencia_tabla    text,
  referencia_id       uuid,
  resuelta            boolean            NOT NULL DEFAULT false,
  resuelta_at         timestamptz,
  resuelta_por        uuid               REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz        NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_consultora_main
  ON public.alertas (consultora_id, resuelta, severidad, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_empresa
  ON public.alertas (empresa_id);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS Policies
-- ============================================================

-- SELECT: cualquier miembro activo de la consultora
CREATE POLICY "alertas: select"
  ON public.alertas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.consultora_id = alertas.consultora_id
        AND cm.is_active = true
    )
  );

-- UPDATE: full_access o responsable_estandares (text cast para compatibilidad con enum parcial)
CREATE POLICY "alertas: update"
  ON public.alertas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.consultora_id = alertas.consultora_id
        AND cm.is_active = true
        AND cm.role::text IN ('full_access_main', 'full_access_branch', 'responsable_estandares')
    )
  )
  WITH CHECK (true);

-- INSERT/DELETE: bloqueados para usuarios — solo la función SECURITY DEFINER puede insertar
CREATE POLICY "alertas: insert"
  ON public.alertas FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "alertas: delete"
  ON public.alertas FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- 4. Función pública: marcar alerta resuelta
-- SECURITY DEFINER porque bypasea el INSERT/DELETE bloqueado.
-- La lógica de quién puede llamarla se hace antes de llamar.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolver_alerta(p_alerta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Verificar que el usuario tiene rol para resolver
  IF NOT EXISTS (
    SELECT 1
    FROM public.alertas a
    JOIN public.consultoras_members cm
      ON cm.consultora_id = a.consultora_id
     AND cm.user_id = v_uid
     AND cm.is_active = true
     AND cm.role::text IN ('full_access_main', 'full_access_branch', 'responsable_estandares')
    WHERE a.id = p_alerta_id
      AND a.resuelta = false
  ) THEN
    RAISE EXCEPTION 'No autorizado o alerta ya resuelta';
  END IF;

  UPDATE public.alertas
  SET resuelta = true,
      resuelta_at = now(),
      resuelta_por = v_uid
  WHERE id = p_alerta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_alerta(uuid) TO authenticated;

-- ============================================================
-- 5. Función de generación batch: generar_alertas_consultora
-- SECURITY DEFINER — llamada desde Edge Function con service_role.
-- Borra alertas no resueltas previas y regenera.
-- ============================================================
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
  -- Limpiar alertas no resueltas anteriores para esta consultora
  DELETE FROM public.alertas
  WHERE consultora_id = p_consultora_id
    AND resuelta = false;

  -- ── CASO 1: documento_por_vencer (warning) ─────────────────────────────
  -- empresas_documentos
  INSERT INTO public.alertas
    (consultora_id, empresa_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT
    e.consultora_id,
    ed.empresa_id,
    'documento_por_vencer',
    'warning',
    'El documento ''' || COALESCE(dt.nombre, 'sin nombre') || ''' vence el '
      || to_char(ed.fecha_vencimiento, 'DD/MM/YYYY'),
    'empresas_documentos',
    ed.id
  FROM public.empresas_documentos ed
  JOIN public.empresas e ON e.id = ed.empresa_id
  JOIN public.documentos_tipos dt ON dt.id = ed.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND ed.fecha_vencimiento IS NOT NULL
    AND ed.fecha_vencimiento >= CURRENT_DATE
    AND ed.fecha_vencimiento <= CURRENT_DATE + interval '30 days';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- establecimientos_documentos
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT
    e.consultora_id,
    e.id,
    esd.establecimiento_id,
    'documento_por_vencer',
    'warning',
    'El documento ''' || COALESCE(dt.nombre, 'sin nombre') || ''' vence el '
      || to_char(esd.fecha_vencimiento, 'DD/MM/YYYY'),
    'establecimientos_documentos',
    esd.id
  FROM public.establecimientos_documentos esd
  JOIN public.establecimientos est ON est.id = esd.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  JOIN public.documentos_tipos dt ON dt.id = esd.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND esd.fecha_vencimiento IS NOT NULL
    AND esd.fecha_vencimiento >= CURRENT_DATE
    AND esd.fecha_vencimiento <= CURRENT_DATE + interval '30 days';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- ── CASO 2: documento_vencido (critical) ───────────────────────────────
  -- empresas_documentos
  INSERT INTO public.alertas
    (consultora_id, empresa_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT
    e.consultora_id,
    ed.empresa_id,
    'documento_vencido',
    'critical',
    'El documento ''' || COALESCE(dt.nombre, 'sin nombre') || ''' venció el '
      || to_char(ed.fecha_vencimiento, 'DD/MM/YYYY'),
    'empresas_documentos',
    ed.id
  FROM public.empresas_documentos ed
  JOIN public.empresas e ON e.id = ed.empresa_id
  JOIN public.documentos_tipos dt ON dt.id = ed.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND ed.fecha_vencimiento IS NOT NULL
    AND ed.fecha_vencimiento < CURRENT_DATE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- establecimientos_documentos
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT
    e.consultora_id,
    e.id,
    esd.establecimiento_id,
    'documento_vencido',
    'critical',
    'El documento ''' || COALESCE(dt.nombre, 'sin nombre') || ''' venció el '
      || to_char(esd.fecha_vencimiento, 'DD/MM/YYYY'),
    'establecimientos_documentos',
    esd.id
  FROM public.establecimientos_documentos esd
  JOIN public.establecimientos est ON est.id = esd.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  JOIN public.documentos_tipos dt ON dt.id = esd.tipo_id
  WHERE e.consultora_id = p_consultora_id
    AND esd.fecha_vencimiento IS NOT NULL
    AND esd.fecha_vencimiento < CURRENT_DATE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- ── CASO 3: siniestro_sin_investigar (warning) ─────────────────────────
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT
    e.consultora_id,
    e.id,
    s.establecimiento_id,
    'siniestro_sin_investigar',
    'warning',
    'Siniestro sin investigar desde hace más de 72hs',
    'siniestros',
    s.id
  FROM public.siniestros s
  JOIN public.establecimientos est ON est.id = s.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND s.estado = 'pendiente'
    AND s.fecha_ocurrencia < now() - interval '72 hours';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- ── CASO 4: siniestro_sin_cerrar (critical) ────────────────────────────
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT
    e.consultora_id,
    e.id,
    s.establecimiento_id,
    'siniestro_sin_cerrar',
    'critical',
    'Siniestro abierto hace más de 30 días sin resolución',
    'siniestros',
    s.id
  FROM public.siniestros s
  JOIN public.establecimientos est ON est.id = s.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND s.estado IN ('pendiente', 'en_investigacion')
    AND s.fecha_ocurrencia < now() - interval '30 days';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- ── CASO 5: capacitacion_no_realizada (warning) ────────────────────────
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT
    e.consultora_id,
    c.empresa_id,
    c.establecimiento_id,
    'capacitacion_no_realizada',
    'warning',
    'La capacitación ''' || c.titulo || ''' no fue marcada como realizada',
    'capacitaciones',
    c.id
  FROM public.capacitaciones c
  JOIN public.empresas e ON e.id = c.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND c.estado = 'programada'
    AND c.fecha_programada < CURRENT_DATE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- ── CASO 6: riesgo_critico_activo (critical) ───────────────────────────
  INSERT INTO public.alertas
    (consultora_id, empresa_id, establecimiento_id, tipo, severidad, mensaje, referencia_tabla, referencia_id)
  SELECT
    e.consultora_id,
    e.id,
    r.establecimiento_id,
    'riesgo_critico_activo',
    'critical',
    'Riesgo crítico sin resolver: ' || r.descripcion,
    'riesgos',
    r.id
  FROM public.riesgos r
  JOIN public.establecimientos est ON est.id = r.establecimiento_id
  JOIN public.empresas e ON e.id = est.empresa_id
  WHERE e.consultora_id = p_consultora_id
    AND r.nivel = 'critico'
    AND r.resuelto = false;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  RETURN v_total;
END;
$$;

-- Solo service_role puede llamar la función de generación batch
REVOKE EXECUTE ON FUNCTION public.generar_alertas_consultora(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generar_alertas_consultora(uuid) TO service_role;

COMMIT;
