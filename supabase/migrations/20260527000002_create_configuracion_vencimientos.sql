-- ============================================================
-- Sigmetría HyS — Configuración de Vencimientos
--
-- Catálogo master donde el admin define qué tipos de
-- documento/gestión tienen vencimiento y los días de aviso.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.configuracion_vencimientos;
--   DROP FUNCTION IF EXISTS public.init_configuracion_vencimientos;
-- ============================================================

-- ============================================================
-- 1. Tabla configuracion_vencimientos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.configuracion_vencimientos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id     uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  tipo_entidad      text NOT NULL CHECK (tipo_entidad IN ('empresa', 'establecimiento', 'persona', 'gestion')),
  nombre            text NOT NULL,
  tiene_vencimiento boolean NOT NULL DEFAULT false,
  dias_aviso        integer NOT NULL DEFAULT 7,
  activo            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cv_consultora
  ON public.configuracion_vencimientos (consultora_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cv_consultora_nombre
  ON public.configuracion_vencimientos (consultora_id, tipo_entidad, nombre);

-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE public.configuracion_vencimientos ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros de la consultora
CREATE POLICY "cv_select" ON public.configuracion_vencimientos
  FOR SELECT USING (
    consultora_id IN (
      SELECT consultora_id FROM public.consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR public.is_super_admin()
  );

-- INSERT / UPDATE / DELETE: admin o super admin
CREATE POLICY "cv_insert" ON public.configuracion_vencimientos
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR public.get_consultora_role(consultora_id) = 'full_access_main'
  );

CREATE POLICY "cv_update" ON public.configuracion_vencimientos
  FOR UPDATE USING (
    public.is_super_admin()
    OR public.get_consultora_role(consultora_id) = 'full_access_main'
  );

CREATE POLICY "cv_delete" ON public.configuracion_vencimientos
  FOR DELETE USING (
    public.is_super_admin()
    OR public.get_consultora_role(consultora_id) = 'full_access_main'
  );

-- ============================================================
-- 3. Función: inicializar config para una consultora
--    Toma los tipos de documento y gestiones activos del
--    catálogo global y crea registros en configuracion_vencimientos
--    si aún no existen para esa consultora.
-- ============================================================
CREATE OR REPLACE FUNCTION public.init_configuracion_vencimientos(p_consultora_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Documentos de empresa
  INSERT INTO public.configuracion_vencimientos (consultora_id, tipo_entidad, nombre)
  SELECT p_consultora_id, 'empresa', dt.nombre
  FROM public.documentos_tipos dt
  WHERE dt.is_active AND dt.aplica_empresa
    AND NOT EXISTS (
      SELECT 1 FROM public.configuracion_vencimientos cv
      WHERE cv.consultora_id = p_consultora_id
        AND cv.tipo_entidad = 'empresa'
        AND cv.nombre = dt.nombre
    );

  -- Documentos de establecimiento
  INSERT INTO public.configuracion_vencimientos (consultora_id, tipo_entidad, nombre)
  SELECT p_consultora_id, 'establecimiento', dt.nombre
  FROM public.documentos_tipos dt
  WHERE dt.is_active AND dt.aplica_establecimiento
    AND NOT EXISTS (
      SELECT 1 FROM public.configuracion_vencimientos cv
      WHERE cv.consultora_id = p_consultora_id
        AND cv.tipo_entidad = 'establecimiento'
        AND cv.nombre = dt.nombre
    );

  -- Documentos de persona
  INSERT INTO public.configuracion_vencimientos (consultora_id, tipo_entidad, nombre)
  SELECT p_consultora_id, 'persona', dt.nombre
  FROM public.documentos_tipos dt
  WHERE dt.is_active AND dt.aplica_empleado
    AND NOT EXISTS (
      SELECT 1 FROM public.configuracion_vencimientos cv
      WHERE cv.consultora_id = p_consultora_id
        AND cv.tipo_entidad = 'persona'
        AND cv.nombre = dt.nombre
    );

  -- Gestiones
  INSERT INTO public.configuracion_vencimientos (consultora_id, tipo_entidad, nombre)
  SELECT p_consultora_id, 'gestion', g.nombre
  FROM public.gestiones g
  WHERE g.tiene_entregable
    AND NOT EXISTS (
      SELECT 1 FROM public.configuracion_vencimientos cv
      WHERE cv.consultora_id = p_consultora_id
        AND cv.tipo_entidad = 'gestion'
        AND cv.nombre = g.nombre
    );
END;
$$;
