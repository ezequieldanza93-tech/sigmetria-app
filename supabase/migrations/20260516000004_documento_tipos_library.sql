-- ============================================================
-- Sigmetría — Librería global de documentos
-- Reemplaza tabla documentos + enum documento_tipo
-- ============================================================

-- 1. Eliminar tabla y enum anteriores
DROP TABLE public.documentos;
DROP TYPE public.documento_tipo;

-- 2. Librería global de tipos de documento
CREATE TABLE public.documento_tipos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                 text NOT NULL UNIQUE,
  descripcion            text,
  aplica_empresa         boolean NOT NULL DEFAULT false,
  aplica_establecimiento boolean NOT NULL DEFAULT false,
  aplica_empleado        boolean NOT NULL DEFAULT false,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aplica_al_menos_uno CHECK (
    aplica_empresa OR aplica_establecimiento OR aplica_empleado
  )
);

-- 3. Historial de documentos por empresa
CREATE TABLE public.empresa_documentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_id           uuid NOT NULL REFERENCES public.documento_tipos(id),
  archivo_url       text,
  fecha_emision     date,
  fecha_vencimiento date,
  subido_por        uuid REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 4. Historial de documentos por establecimiento
CREATE TABLE public.establecimiento_documentos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  tipo_id            uuid NOT NULL REFERENCES public.documento_tipos(id),
  archivo_url        text,
  fecha_emision      date,
  fecha_vencimiento  date,
  subido_por         uuid REFERENCES public.profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- 5. Historial de documentos por empleado
CREATE TABLE public.empleado_documentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id       uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  tipo_id           uuid NOT NULL REFERENCES public.documento_tipos(id),
  archivo_url       text,
  fecha_emision     date,
  fecha_vencimiento date,
  subido_por        uuid REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 6. RLS
ALTER TABLE public.documento_tipos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_documentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establecimiento_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleado_documentos      ENABLE ROW LEVEL SECURITY;

-- documento_tipos — lectura global para usuarios autenticados, escritura solo developers
CREATE POLICY "documento_tipos: select" ON public.documento_tipos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "documento_tipos: insert" ON public.documento_tipos FOR INSERT
  WITH CHECK (is_developer());

CREATE POLICY "documento_tipos: update" ON public.documento_tipos FOR UPDATE
  USING (is_developer());

CREATE POLICY "documento_tipos: delete" ON public.documento_tipos FOR DELETE
  USING (is_developer());

-- empresa_documentos
CREATE POLICY "empresa_documentos: select" ON public.empresa_documentos FOR SELECT
  USING (has_empresa_read_access(empresa_id));

CREATE POLICY "empresa_documentos: insert" ON public.empresa_documentos FOR INSERT
  WITH CHECK (has_empresa_write_access(empresa_id));

CREATE POLICY "empresa_documentos: update" ON public.empresa_documentos FOR UPDATE
  USING (has_empresa_write_access(empresa_id));

CREATE POLICY "empresa_documentos: delete" ON public.empresa_documentos FOR DELETE
  USING (has_empresa_write_access(empresa_id));

-- establecimiento_documentos
CREATE POLICY "establecimiento_documentos: select" ON public.establecimiento_documentos FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "establecimiento_documentos: insert" ON public.establecimiento_documentos FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "establecimiento_documentos: update" ON public.establecimiento_documentos FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "establecimiento_documentos: delete" ON public.establecimiento_documentos FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));

-- empleado_documentos — acceso derivado via jerarquía puesto → sector → establecimiento
CREATE POLICY "empleado_documentos: select" ON public.empleado_documentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.empleado_id = empleado_documentos.empleado_id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_documentos: insert" ON public.empleado_documentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.empleado_id = empleado_documentos.empleado_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_documentos: update" ON public.empleado_documentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.empleado_id = empleado_documentos.empleado_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_documentos: delete" ON public.empleado_documentos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.empleado_id = empleado_documentos.empleado_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );
