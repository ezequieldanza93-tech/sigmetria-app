-- ============================================================================
-- Identidad normalizada (cuenta ↔ persona del directorio) + Viewer de Observaciones
-- ============================================================================

-- 1. Link cuenta ↔ persona del directorio. La PERSONA es dueña del email.
--    Así el cambio de email se hace sobre la persona y no rompe la normalización.
ALTER TABLE public.personas_directorio
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personas_directorio_user_id
  ON public.personas_directorio (user_id) WHERE user_id IS NOT NULL;

-- Backfill: linkear personas existentes con su cuenta por email (one-time).
UPDATE public.personas_directorio pd
SET user_id = u.id
FROM auth.users u
WHERE pd.user_id IS NULL
  AND pd.email IS NOT NULL
  AND lower(pd.email) = lower(u.email);

-- 2. RLS: un usuario VE las observaciones donde su persona es responsable.
--    Política ADITIVA: no afecta a los roles existentes (se evalúa por OR).
DROP POLICY IF EXISTS "gestiones_observaciones: select responsable" ON public.gestiones_observaciones;
CREATE POLICY "gestiones_observaciones: select responsable"
  ON public.gestiones_observaciones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personas_directorio pd
      WHERE pd.id = gestiones_observaciones.responsable_id
        AND pd.user_id = (SELECT auth.uid())
    )
  );

-- 3. RLS comentarios: el responsable puede leer y comentar en SUS observaciones.
DROP POLICY IF EXISTS "observaciones_comentarios: select responsable" ON public.observaciones_comentarios;
CREATE POLICY "observaciones_comentarios: select responsable"
  ON public.observaciones_comentarios FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_observaciones go
      JOIN public.personas_directorio pd ON pd.id = go.responsable_id
      WHERE go.id = observaciones_comentarios.observacion_id
        AND pd.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "observaciones_comentarios: insert responsable" ON public.observaciones_comentarios;
CREATE POLICY "observaciones_comentarios: insert responsable"
  ON public.observaciones_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.gestiones_observaciones go
      JOIN public.personas_directorio pd ON pd.id = go.responsable_id
      WHERE go.id = observaciones_comentarios.observacion_id
        AND pd.user_id = (SELECT auth.uid())
    )
  );

-- 4. RPC: observaciones del responsable actual (con contexto de empresa/establecimiento).
--    SECURITY DEFINER para devolver el contexto sin abrir RLS de tablas padre.
CREATE OR REPLACE FUNCTION public.mis_observaciones()
RETURNS TABLE (
  id uuid,
  descripcion text,
  fecha_planificada date,
  fecha_cierre date,
  evidencia_cierre_url text,
  establecimiento_nombre text,
  empresa_nombre text
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    go.id,
    go.descripcion,
    go.fecha_planificada,
    go.fecha_cierre,
    go.evidencia_cierre_url,
    est.nombre        AS establecimiento_nombre,
    emp.razon_social  AS empresa_nombre
  FROM public.gestiones_observaciones go
  JOIN public.personas_directorio pd
    ON pd.id = go.responsable_id AND pd.user_id = (SELECT auth.uid())
  LEFT JOIN public.gestiones_registros gr        ON gr.id = go.registro_gestion_id
  LEFT JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
  LEFT JOIN public.establecimientos est          ON est.id = ge.establecimiento_id
  LEFT JOIN public.empresas emp                  ON emp.id = est.empresa_id
  ORDER BY (go.fecha_cierre IS NOT NULL), go.fecha_planificada
$$;
GRANT EXECUTE ON FUNCTION public.mis_observaciones() TO authenticated;

-- 5. RPC: cerrar una observación propia. Evidencia (foto O adjunto) OBLIGATORIA.
--    Solo aplica al responsable: refuerza la trazabilidad SRT 48/2025.
CREATE OR REPLACE FUNCTION public.cerrar_observacion_responsable(
  p_observacion_id uuid,
  p_evidencia_url  text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_evidencia_url IS NULL OR length(trim(p_evidencia_url)) = 0 THEN
    RAISE EXCEPTION 'La evidencia de cierre (foto o adjunto) es obligatoria';
  END IF;

  UPDATE public.gestiones_observaciones go
  SET fecha_cierre = CURRENT_DATE,
      evidencia_cierre_url = p_evidencia_url,
      updated_at = now()
  WHERE go.id = p_observacion_id
    AND go.fecha_cierre IS NULL
    AND EXISTS (
      SELECT 1 FROM public.personas_directorio pd
      WHERE pd.id = go.responsable_id
        AND pd.user_id = (SELECT auth.uid())
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No podés cerrar esta observación (no sos el responsable o ya está cerrada)';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cerrar_observacion_responsable(uuid, text) TO authenticated;
