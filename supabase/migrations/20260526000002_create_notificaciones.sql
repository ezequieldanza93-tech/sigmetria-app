-- ============================================================
-- Sigmetría HyS — Sistema de Notificaciones
--
-- notificaciones: alertas globales scoped a la consultora
--   - Se generan al refrescar: 10 días, 3 días, y el día del vencimiento
--   - Abarcan: gestiones_registros, empresa_documentos,
--     establecimiento_documentos, personas_documentos,
--     matriculas, certificados_calibracion
--
-- notificaciones_leidas: tracking de lectura por usuario
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.notificaciones_leidas;
--   DROP TABLE IF EXISTS public.notificaciones;
-- ============================================================

-- ============================================================
-- 1. Tabla notificaciones (global, scoped a consultora)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id     uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  tipo              text NOT NULL,       -- 'vencimiento'
  entidad_tipo      text NOT NULL,       -- 'gestion', 'documento_empresa', 'documento_establecimiento', 'documento_persona', 'matricula', 'certificado'
  entidad_id        uuid NOT NULL,       -- id del registro original
  titulo            text NOT NULL,
  mensaje           text NOT NULL,
  entidad_nombre    text NOT NULL,
  contexto_nombre   text,                -- nombre del establecimiento / empresa / persona
  fecha_vencimiento date NOT NULL,
  dias_restantes    integer NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Evita duplicados: misma consultora, misma entidad, mismos días restantes
CREATE UNIQUE INDEX IF NOT EXISTS idx_notificaciones_uniq
  ON public.notificaciones (consultora_id, entidad_tipo, entidad_id, dias_restantes);

CREATE INDEX IF NOT EXISTS idx_notificaciones_consultora
  ON public.notificaciones (consultora_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_vencimiento
  ON public.notificaciones (fecha_vencimiento);

-- ============================================================
-- 2. Tabla notificaciones_leidas (per-user read tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notificaciones_leidas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id uuid NOT NULL REFERENCES public.notificaciones(id) ON DELETE CASCADE,
  usuario_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leida_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notificacion_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_leidas_usuario
  ON public.notificaciones_leidas (usuario_id, leida_en DESC);

-- ============================================================
-- 3. RLS — notificaciones
-- ============================================================
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones_leidas ENABLE ROW LEVEL SECURITY;

-- SELECT: el usuario ve notificaciones de su consultora
CREATE POLICY "notificaciones_select" ON public.notificaciones
  FOR SELECT USING (
    consultora_id IN (
      SELECT consultora_id FROM public.consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR public.is_super_admin()
  );

-- INSERT / UPDATE / DELETE: solo super admin o via server function
CREATE POLICY "notificaciones_insert" ON public.notificaciones
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "notificaciones_update" ON public.notificaciones
  FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "notificaciones_delete" ON public.notificaciones
  FOR DELETE USING (public.is_super_admin());

-- notificaciones_leidas: cada usuario ve y managea sus propias
CREATE POLICY "notificaciones_leidas_select" ON public.notificaciones_leidas
  FOR SELECT USING (usuario_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "notificaciones_leidas_insert" ON public.notificaciones_leidas
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "notificaciones_leidas_update" ON public.notificaciones_leidas
  FOR UPDATE USING (usuario_id = auth.uid());

CREATE POLICY "notificaciones_leidas_delete" ON public.notificaciones_leidas
  FOR DELETE USING (usuario_id = auth.uid());

-- ============================================================
-- 4. Función auxiliar: contar no leídas para un usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_notificaciones_no_leidas(p_usuario_id uuid)
RETURNS bigint
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.notificaciones n
  WHERE n.consultora_id IN (
    SELECT consultora_id FROM public.consultoras_members
    WHERE user_id = p_usuario_id AND is_active = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones_leidas nl
    WHERE nl.notificacion_id = n.id AND nl.usuario_id = p_usuario_id
  );
$$;
