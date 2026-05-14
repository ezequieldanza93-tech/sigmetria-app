-- ============================================================
-- Sigmetria App — Tablas funcionales HyS
-- ============================================================

CREATE TYPE public.siniestro_tipo AS ENUM (
  'accidente', 'incidente', 'casi_accidente', 'enfermedad_profesional'
);
CREATE TYPE public.siniestro_estado AS ENUM (
  'pendiente', 'en_investigacion', 'cerrado'
);
CREATE TYPE public.inspeccion_estado AS ENUM (
  'programada', 'realizada', 'con_observaciones', 'cancelada'
);
CREATE TYPE public.capacitacion_estado AS ENUM (
  'programada', 'realizada', 'cancelada'
);
CREATE TYPE public.riesgo_nivel AS ENUM (
  'bajo', 'medio', 'alto', 'critico'
);
CREATE TYPE public.medicion_tipo AS ENUM (
  'ruido', 'iluminacion', 'temperatura', 'humedad',
  'vibraciones', 'gases', 'polvo', 'otro'
);
CREATE TYPE public.documento_tipo AS ENUM (
  'habilitacion', 'seguro', 'certificado',
  'procedimiento', 'instructivo', 'otro'
);

-- ============================================================
-- EMPLEADOS — trabajadores de cada establecimiento
-- ============================================================
CREATE TABLE public.empleados (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  nombre             text NOT NULL,
  apellido           text NOT NULL,
  dni                text,
  cargo              text,
  fecha_ingreso      date,
  is_active          boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ============================================================
-- SINIESTROS — accidentes e incidentes laborales
-- ============================================================
CREATE TABLE public.siniestros (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id   uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  empleado_id          uuid REFERENCES public.empleados(id),
  tipo                 public.siniestro_tipo NOT NULL,
  estado               public.siniestro_estado NOT NULL DEFAULT 'pendiente',
  fecha_ocurrencia     timestamptz NOT NULL,
  descripcion          text NOT NULL,
  dias_perdidos        int DEFAULT 0,
  requiere_derivacion  boolean DEFAULT false,
  acciones_correctivas text,
  reportado_por        uuid REFERENCES public.profiles(id),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ============================================================
-- INSPECCIONES — visitas de control HyS
-- ============================================================
CREATE TABLE public.inspecciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  estado             public.inspeccion_estado NOT NULL DEFAULT 'programada',
  fecha_programada   date NOT NULL,
  fecha_realizada    date,
  inspector_id       uuid REFERENCES public.profiles(id),
  observaciones      text,
  puntaje            int CHECK (puntaje BETWEEN 0 AND 100),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ============================================================
-- CAPACITACIONES — formaciones por empresa o establecimiento
-- ============================================================
CREATE TABLE public.capacitaciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  establecimiento_id uuid REFERENCES public.establecimientos(id),
  titulo             text NOT NULL,
  descripcion        text,
  estado             public.capacitacion_estado NOT NULL DEFAULT 'programada',
  fecha_programada   date NOT NULL,
  fecha_realizada    date,
  instructor         text,
  duracion_horas     numeric(4,1),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE public.capacitacion_asistentes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capacitacion_id  uuid NOT NULL REFERENCES public.capacitaciones(id) ON DELETE CASCADE,
  empleado_id      uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  asistio          boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(capacitacion_id, empleado_id)
);

-- ============================================================
-- RIESGOS — evaluaciones de riesgo laboral
-- ============================================================
CREATE TABLE public.riesgos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id   uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  descripcion          text NOT NULL,
  nivel                public.riesgo_nivel NOT NULL,
  medida_correctiva    text,
  responsable_id       uuid REFERENCES public.profiles(id),
  fecha_identificacion date NOT NULL DEFAULT CURRENT_DATE,
  fecha_resolucion     date,
  resuelto             boolean DEFAULT false,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ============================================================
-- MEDICIONES — ruido, iluminación, temperatura, etc.
-- ============================================================
CREATE TABLE public.mediciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  tipo               public.medicion_tipo NOT NULL,
  fecha              date NOT NULL,
  valor              numeric(10,2) NOT NULL,
  unidad             text NOT NULL,
  sector             text,
  cumple_normativa   boolean,
  observaciones      text,
  realizado_por      uuid REFERENCES public.profiles(id),
  created_at         timestamptz DEFAULT now()
);

-- ============================================================
-- DOCUMENTOS — habilitaciones, seguros, certificados, etc.
-- ============================================================
CREATE TABLE public.documentos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  establecimiento_id uuid REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  tipo               public.documento_tipo NOT NULL,
  nombre             text NOT NULL,
  archivo_url        text,
  fecha_emision      date,
  fecha_vencimiento  date,
  es_vigente         boolean DEFAULT true,
  subido_por         uuid REFERENCES public.profiles(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ============================================================
-- RLS habilitado
-- ============================================================
ALTER TABLE public.empleados              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siniestros             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacitaciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacitacion_asistentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riesgos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediciones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES — reutilizan las helper functions de migración 2
-- ============================================================

-- EMPLEADOS
CREATE POLICY "empleados: select" ON public.empleados FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));
CREATE POLICY "empleados: insert" ON public.empleados FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "empleados: update" ON public.empleados FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "empleados: delete" ON public.empleados FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));

-- SINIESTROS
CREATE POLICY "siniestros: select" ON public.siniestros FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));
CREATE POLICY "siniestros: insert" ON public.siniestros FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "siniestros: update" ON public.siniestros FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "siniestros: delete" ON public.siniestros FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));

-- INSPECCIONES
CREATE POLICY "inspecciones: select" ON public.inspecciones FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));
CREATE POLICY "inspecciones: insert" ON public.inspecciones FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "inspecciones: update" ON public.inspecciones FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "inspecciones: delete" ON public.inspecciones FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));

-- CAPACITACIONES
CREATE POLICY "capacitaciones: select" ON public.capacitaciones FOR SELECT
  USING (has_empresa_read_access(empresa_id));
CREATE POLICY "capacitaciones: insert" ON public.capacitaciones FOR INSERT
  WITH CHECK (has_empresa_write_access(empresa_id));
CREATE POLICY "capacitaciones: update" ON public.capacitaciones FOR UPDATE
  USING (has_empresa_write_access(empresa_id));
CREATE POLICY "capacitaciones: delete" ON public.capacitaciones FOR DELETE
  USING (has_empresa_write_access(empresa_id));

-- CAPACITACION_ASISTENTES
CREATE POLICY "capacitacion_asistentes: select" ON public.capacitacion_asistentes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.capacitaciones c
    WHERE c.id = capacitacion_id AND has_empresa_read_access(c.empresa_id)
  ));
CREATE POLICY "capacitacion_asistentes: insert" ON public.capacitacion_asistentes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.capacitaciones c
    WHERE c.id = capacitacion_id AND has_empresa_write_access(c.empresa_id)
  ));
CREATE POLICY "capacitacion_asistentes: update" ON public.capacitacion_asistentes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.capacitaciones c
    WHERE c.id = capacitacion_id AND has_empresa_write_access(c.empresa_id)
  ));
CREATE POLICY "capacitacion_asistentes: delete" ON public.capacitacion_asistentes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.capacitaciones c
    WHERE c.id = capacitacion_id AND has_empresa_write_access(c.empresa_id)
  ));

-- RIESGOS
CREATE POLICY "riesgos: select" ON public.riesgos FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));
CREATE POLICY "riesgos: insert" ON public.riesgos FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "riesgos: update" ON public.riesgos FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "riesgos: delete" ON public.riesgos FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));

-- MEDICIONES
CREATE POLICY "mediciones: select" ON public.mediciones FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));
CREATE POLICY "mediciones: insert" ON public.mediciones FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "mediciones: update" ON public.mediciones FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "mediciones: delete" ON public.mediciones FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));

-- DOCUMENTOS (pueden ser de empresa o establecimiento)
CREATE POLICY "documentos: select" ON public.documentos FOR SELECT
  USING (
    is_developer()
    OR (empresa_id IS NOT NULL AND has_empresa_read_access(empresa_id))
    OR (establecimiento_id IS NOT NULL AND has_establecimiento_read_access(establecimiento_id))
  );
CREATE POLICY "documentos: insert" ON public.documentos FOR INSERT
  WITH CHECK (
    is_developer()
    OR (empresa_id IS NOT NULL AND has_empresa_write_access(empresa_id))
    OR (establecimiento_id IS NOT NULL AND has_establecimiento_write_access(establecimiento_id))
  );
CREATE POLICY "documentos: update" ON public.documentos FOR UPDATE
  USING (
    is_developer()
    OR (empresa_id IS NOT NULL AND has_empresa_write_access(empresa_id))
    OR (establecimiento_id IS NOT NULL AND has_establecimiento_write_access(establecimiento_id))
  );
CREATE POLICY "documentos: delete" ON public.documentos FOR DELETE
  USING (
    is_developer()
    OR (empresa_id IS NOT NULL AND has_empresa_write_access(empresa_id))
    OR (establecimiento_id IS NOT NULL AND has_establecimiento_write_access(establecimiento_id))
  );
