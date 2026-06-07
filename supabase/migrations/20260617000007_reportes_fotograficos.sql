-- ============================================================
-- Ejecutor de Reporte Fotográfico [Periódico/Semanal/Mensual]
-- ============================================================
-- Nuevo flujo: una gestión de tipo 'reporte_fotografico' se EJECUTA subiendo un
-- PAQUETE de fotos, editándolas foto-por-foto, y guardando un REPORTE (cabecera
-- + fotos + PDF + estado). Las OBSERVACIONES accionables se suman al pool común
-- `gestiones_observaciones` (con link reporte_id) → aparecen en Seguimiento sin
-- sync extra (decisión del dueño: unificar con todas las observaciones de gestiones).
--
-- Diseño:
--   - gestiones.tipo_ejecucion discrimina el flujo del botón Ejecutar.
--   - reportes_fotograficos = cabecera del reporte (1 fila por ejecución).
--   - reportes_fotograficos_fotos = las N fotos editadas del paquete.
--   - gestiones_observaciones.reporte_id = link de las observaciones a su reporte.
--   - El reporte referencia su gestiones_registros (suelto: esa tabla está
--     particionada por fecha_planificada, PK compuesta → no se usa FK dura).
--
-- Idempotente. RLS por tenant con public.is_member_of_consultora (helper existente).
-- ============================================================

-- ─── 1. Discriminador de tipo de ejecución en el catálogo de gestiones ──
ALTER TABLE public.gestiones ADD COLUMN IF NOT EXISTS tipo_ejecucion text NOT NULL DEFAULT 'estandar';
ALTER TABLE public.gestiones DROP CONSTRAINT IF EXISTS chk_gestiones_tipo_ejecucion;
ALTER TABLE public.gestiones ADD CONSTRAINT chk_gestiones_tipo_ejecucion
  CHECK (tipo_ejecucion IN ('estandar', 'reporte_fotografico'));
COMMENT ON COLUMN public.gestiones.tipo_ejecucion IS
  'Flujo del botón Ejecutar: estandar (carga 1 archivo) | reporte_fotografico (wizard multi-foto + PDF).';

-- ─── 2. Cabecera del reporte ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reportes_fotograficos (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id               uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id          uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  gestion_establecimiento_id  uuid REFERENCES public.gestiones_establecimientos(id) ON DELETE SET NULL,
  registro_gestion_id         uuid,            -- referencia suelta (gestiones_registros está particionada)
  rg_fecha_planificada        date,
  periodicidad                text,            -- 'semanal' | 'mensual' | 'periodico'
  periodo_desde               date,
  periodo_hasta               date,
  pdf_url                     text,            -- PATH en bucket `documentos` (no URL)
  estado                      text NOT NULL DEFAULT 'borrador',  -- 'borrador' | 'evaluado' | 'distribuido'
  comentario                  text,
  generado_por                uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);
ALTER TABLE public.reportes_fotograficos DROP CONSTRAINT IF EXISTS chk_reporte_estado;
ALTER TABLE public.reportes_fotograficos ADD CONSTRAINT chk_reporte_estado
  CHECK (estado IN ('borrador', 'evaluado', 'distribuido'));
ALTER TABLE public.reportes_fotograficos DROP CONSTRAINT IF EXISTS chk_reporte_periodicidad;
ALTER TABLE public.reportes_fotograficos ADD CONSTRAINT chk_reporte_periodicidad
  CHECK (periodicidad IS NULL OR periodicidad IN ('semanal', 'mensual', 'periodico'));

CREATE INDEX IF NOT EXISTS idx_reportes_fot_consultora ON public.reportes_fotograficos (consultora_id);
CREATE INDEX IF NOT EXISTS idx_reportes_fot_establecimiento
  ON public.reportes_fotograficos (establecimiento_id, created_at DESC) WHERE deleted_at IS NULL;

-- ─── 3. Fotos editadas del paquete ──────────────────────────
CREATE TABLE IF NOT EXISTS public.reportes_fotograficos_fotos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id   uuid NOT NULL REFERENCES public.reportes_fotograficos(id) ON DELETE CASCADE,
  foto_url     text NOT NULL,   -- PATH (foto editada) en bucket `documentos`
  orden        integer NOT NULL DEFAULT 0,
  anotaciones  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reportes_fot_fotos_reporte
  ON public.reportes_fotograficos_fotos (reporte_id, orden);

-- ─── 4. Link de observaciones al reporte (pool común) ───────
-- Las observaciones siguen viviendo en gestiones_observaciones (Seguimiento);
-- reporte_id solo las vincula al reporte que las originó.
ALTER TABLE public.gestiones_observaciones
  ADD COLUMN IF NOT EXISTS reporte_id uuid REFERENCES public.reportes_fotograficos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gestiones_obs_reporte
  ON public.gestiones_observaciones (reporte_id) WHERE reporte_id IS NOT NULL;

-- ─── 5. RLS por tenant ──────────────────────────────────────
ALTER TABLE public.reportes_fotograficos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reportes_fot: select" ON public.reportes_fotograficos;
CREATE POLICY "reportes_fot: select" ON public.reportes_fotograficos FOR SELECT
  USING ((deleted_at IS NULL OR public.is_developer()) AND public.is_member_of_consultora(consultora_id));

DROP POLICY IF EXISTS "reportes_fot: insert" ON public.reportes_fotograficos;
CREATE POLICY "reportes_fot: insert" ON public.reportes_fotograficos FOR INSERT
  WITH CHECK (public.is_member_of_consultora(consultora_id));

DROP POLICY IF EXISTS "reportes_fot: update" ON public.reportes_fotograficos;
CREATE POLICY "reportes_fot: update" ON public.reportes_fotograficos FOR UPDATE
  USING (public.is_member_of_consultora(consultora_id))
  WITH CHECK (public.is_member_of_consultora(consultora_id));

DROP POLICY IF EXISTS "reportes_fot: delete" ON public.reportes_fotograficos;
CREATE POLICY "reportes_fot: delete" ON public.reportes_fotograficos FOR DELETE
  USING (public.is_developer());

ALTER TABLE public.reportes_fotograficos_fotos ENABLE ROW LEVEL SECURITY;

-- Las fotos heredan el tenant del reporte padre.
DROP POLICY IF EXISTS "reportes_fot_fotos: all" ON public.reportes_fotograficos_fotos;
CREATE POLICY "reportes_fot_fotos: all" ON public.reportes_fotograficos_fotos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.reportes_fotograficos r
    WHERE r.id = reporte_id AND public.is_member_of_consultora(r.consultora_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reportes_fotograficos r
    WHERE r.id = reporte_id AND public.is_member_of_consultora(r.consultora_id)
  ));

-- ─── 6. Marcar la gestión de catálogo que usa este flujo ────
UPDATE public.gestiones SET tipo_ejecucion = 'reporte_fotografico'
WHERE nombre = 'Informe Fotográfico del Establecimiento';

COMMENT ON TABLE public.reportes_fotograficos IS
  'Cabecera de un Reporte Fotográfico (paquete de fotos editadas + PDF + estado). Las observaciones accionables viven en gestiones_observaciones (link reporte_id) para unificar el Seguimiento.';
