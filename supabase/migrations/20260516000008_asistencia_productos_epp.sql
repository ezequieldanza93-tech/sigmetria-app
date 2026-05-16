-- ============================================================
-- Sigmetría — Asistencia diaria, Productos y EPP por puesto
-- ============================================================


-- ============================================================
-- 1. asistencia_diaria — registro de presencia por persona y establecimiento
-- ============================================================
CREATE TABLE public.asistencia_diaria (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id         uuid NOT NULL REFERENCES public.directorio_personas(id) ON DELETE CASCADE,
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  fecha              date NOT NULL,
  hora_entrada       timestamptz NOT NULL,
  hora_salida        timestamptz,
  observaciones      text,
  registrado_por     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asistencia_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asistencia_diaria: select" ON public.asistencia_diaria FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "asistencia_diaria: insert" ON public.asistencia_diaria FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "asistencia_diaria: update" ON public.asistencia_diaria FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "asistencia_diaria: delete" ON public.asistencia_diaria FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));


-- ============================================================
-- 2. categoria_productos — catálogo maestro de categorías
-- ============================================================
CREATE TABLE public.categoria_productos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categoria_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categoria_productos: select" ON public.categoria_productos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "categoria_productos: insert" ON public.categoria_productos FOR INSERT
  WITH CHECK (is_developer());

CREATE POLICY "categoria_productos: update" ON public.categoria_productos FOR UPDATE
  USING (is_developer());

CREATE POLICY "categoria_productos: delete" ON public.categoria_productos FOR DELETE
  USING (is_developer());

INSERT INTO public.categoria_productos (nombre) VALUES
  ('EPP');


-- ============================================================
-- 3. unidad_medida — enum de unidades de medida para productos
-- ============================================================
CREATE TYPE public.unidad_medida AS ENUM (
  'g',
  'kg',
  'ml',
  'l',
  'unidad',
  'par',
  'caja',
  'rollo',
  'metro'
);


-- ============================================================
-- 4. productos — catálogo de productos (EPP y otros)
-- ============================================================
CREATE TABLE public.productos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  descripcion  text,
  marca_id     uuid REFERENCES public.organizaciones(id) ON DELETE SET NULL,
  categoria_id uuid NOT NULL REFERENCES public.categoria_productos(id),
  tamano       numeric(10, 2),
  unidad       public.unidad_medida,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro activo de la consultora
CREATE POLICY "productos: select" ON public.productos FOR SELECT
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
    )
  );

-- INSERT: miembros con rol operativo (no viewer)
CREATE POLICY "productos: insert" ON public.productos FOR INSERT
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

-- UPDATE: miembros con rol operativo (no viewer)
CREATE POLICY "productos: update" ON public.productos FOR UPDATE
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

-- DELETE: solo admins
CREATE POLICY "productos: delete" ON public.productos FOR DELETE
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );


-- ============================================================
-- 5. epp_por_puesto — junction puestos_de_trabajo ↔ productos
--    Define qué EPP requiere cada puesto y su vida útil estimada
-- ============================================================
CREATE TABLE public.epp_por_puesto (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  puesto_id       uuid NOT NULL REFERENCES public.puestos_de_trabajo(id) ON DELETE CASCADE,
  producto_id     uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  horas_vida_util numeric(10, 2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (puesto_id, producto_id)
);

ALTER TABLE public.epp_por_puesto ENABLE ROW LEVEL SECURITY;

-- RLS: acceso derivado vía puesto → sector → establecimiento (mismo patrón que puestos_de_trabajo)
CREATE POLICY "epp_por_puesto: select" ON public.epp_por_puesto FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

CREATE POLICY "epp_por_puesto: insert" ON public.epp_por_puesto FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "epp_por_puesto: delete" ON public.epp_por_puesto FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );
