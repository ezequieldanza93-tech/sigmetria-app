-- ============================================================
-- Migration 010: Instrumentos de Medición, Matrículas,
--                Certificados de Calibración, Gestiones
-- ============================================================


-- ============================================================
-- C. INSTRUMENTOS DE MEDICIÓN
-- ============================================================

-- C.1 Tipo de Instrumento de Medición
CREATE TABLE public.tipo_instrumento_medicion (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipo_instrumento_medicion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipo_instrumento_medicion: select" ON public.tipo_instrumento_medicion
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "tipo_instrumento_medicion: insert" ON public.tipo_instrumento_medicion
  FOR INSERT TO authenticated WITH CHECK (is_developer());

CREATE POLICY "tipo_instrumento_medicion: update" ON public.tipo_instrumento_medicion
  FOR UPDATE TO authenticated USING (is_developer());

INSERT INTO public.tipo_instrumento_medicion (nombre) VALUES
  ('Luxómetro'),
  ('Decibelímetro'),
  ('Vibrómetro'),
  ('Telurímetro');


-- C.2 Instrumentos de Medición
CREATE TABLE public.instrumentos_medicion (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id       uuid NOT NULL REFERENCES public.tipo_instrumento_medicion(id),
  marca_id      uuid REFERENCES public.organizaciones_externas(id) ON DELETE SET NULL,
  modelo        text NOT NULL,
  numero_serie  text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instrumentos_medicion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instrumentos_medicion: select" ON public.instrumentos_medicion
  FOR SELECT TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    )
  );

CREATE POLICY "instrumentos_medicion: insert" ON public.instrumentos_medicion
  FOR INSERT TO authenticated
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

CREATE POLICY "instrumentos_medicion: update" ON public.instrumentos_medicion
  FOR UPDATE TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

CREATE POLICY "instrumentos_medicion: delete" ON public.instrumentos_medicion
  FOR DELETE TO authenticated
  USING (is_developer());


-- ============================================================
-- D. HISTÓRICOS QUE VENCEN Y SE RENUEVAN
-- ============================================================

-- D.1 Matrículas (profesionales del Equipo Consultora)
CREATE TABLE public.matriculas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id          uuid NOT NULL REFERENCES public.directorio_personas(id) ON DELETE CASCADE,
  numero              text NOT NULL,
  organismo_emisor_id uuid REFERENCES public.organizaciones_externas(id) ON DELETE SET NULL,
  fecha_emision       date NOT NULL,
  fecha_vencimiento   date NOT NULL,
  certificado_url     text,
  activa              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matriculas: select" ON public.matriculas
  FOR SELECT TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    )
  );

CREATE POLICY "matriculas: insert" ON public.matriculas
  FOR INSERT TO authenticated
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

CREATE POLICY "matriculas: update" ON public.matriculas
  FOR UPDATE TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );


-- D.2 Certificados de Calibración
CREATE TABLE public.certificados_calibracion (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_id      uuid NOT NULL REFERENCES public.instrumentos_medicion(id) ON DELETE CASCADE,
  fecha_emision       date NOT NULL,
  fecha_vencimiento   date NOT NULL,
  organismo_emisor_id uuid REFERENCES public.organizaciones_externas(id) ON DELETE SET NULL,
  certificado_url     text,
  activo              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certificados_calibracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificados_calibracion: select" ON public.certificados_calibracion
  FOR SELECT TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    )
  );

CREATE POLICY "certificados_calibracion: insert" ON public.certificados_calibracion
  FOR INSERT TO authenticated
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

CREATE POLICY "certificados_calibracion: update" ON public.certificados_calibracion
  FOR UPDATE TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );


-- ============================================================
-- E. GESTIONES
-- ============================================================

-- E.1 Categoría de Gestiones
CREATE TABLE public.categoria_gestiones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categoria_gestiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categoria_gestiones: select" ON public.categoria_gestiones
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "categoria_gestiones: insert" ON public.categoria_gestiones
  FOR INSERT TO authenticated WITH CHECK (is_developer());

CREATE POLICY "categoria_gestiones: update" ON public.categoria_gestiones
  FOR UPDATE TO authenticated USING (is_developer());

INSERT INTO public.categoria_gestiones (nombre) VALUES
  ('Reuniones'),
  ('Controles Operativos'),
  ('Formaciones');


-- E.2 Gestiones (catálogo maestro)
CREATE TABLE public.gestiones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  categoria_id uuid NOT NULL REFERENCES public.categoria_gestiones(id),
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gestiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestiones: select" ON public.gestiones
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "gestiones: insert" ON public.gestiones
  FOR INSERT TO authenticated
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );

CREATE POLICY "gestiones: update" ON public.gestiones
  FOR UPDATE TO authenticated
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );

-- Seed gestiones (mapped to categories via subquery)
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT 'Check', id FROM public.categoria_gestiones WHERE nombre = 'Controles Operativos';

INSERT INTO public.gestiones (nombre, categoria_id)
SELECT 'Permisos de Trabajo', id FROM public.categoria_gestiones WHERE nombre = 'Controles Operativos';

INSERT INTO public.gestiones (nombre, categoria_id)
SELECT 'Capacitaciones', id FROM public.categoria_gestiones WHERE nombre = 'Formaciones';

INSERT INTO public.gestiones (nombre, categoria_id)
SELECT 'Reuniones', id FROM public.categoria_gestiones WHERE nombre = 'Reuniones';

INSERT INTO public.gestiones (nombre, categoria_id)
SELECT 'Comité Mixto', id FROM public.categoria_gestiones WHERE nombre = 'Reuniones';


-- E.3 Gestión-Establecimiento (junction: qué gestiones aplican a cada establecimiento)
CREATE TABLE public.gestion_establecimiento (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestion_id         uuid NOT NULL REFERENCES public.gestiones(id) ON DELETE CASCADE,
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gestion_id, establecimiento_id)
);

ALTER TABLE public.gestion_establecimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestion_establecimiento: select" ON public.gestion_establecimiento
  FOR SELECT TO authenticated
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "gestion_establecimiento: insert" ON public.gestion_establecimiento
  FOR INSERT TO authenticated
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "gestion_establecimiento: delete" ON public.gestion_establecimiento
  FOR DELETE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));


-- E.4 Registro de Gestiones por Establecimiento
-- estado es calculado en la capa de aplicación:
--   fecha_ejecutada NOT NULL → "Ejecutado"
--   fecha_ejecutada NULL AND fecha_planificada < hoy → "Pendiente"
--   fecha_ejecutada NULL AND fecha_planificada >= hoy → "Planificado"
CREATE TABLE public.registro_gestiones (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestion_establecimiento_id uuid NOT NULL REFERENCES public.gestion_establecimiento(id) ON DELETE CASCADE,
  index                     numeric,
  fecha_planificada         date NOT NULL,
  fecha_ejecutada           date,
  responsable_id            uuid REFERENCES public.directorio_personas(id) ON DELETE SET NULL,
  evidencia_url             text,
  notas                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registro_gestiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registro_gestiones: select" ON public.registro_gestiones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestion_establecimiento ge
      WHERE ge.id = registro_gestiones.gestion_establecimiento_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "registro_gestiones: insert" ON public.registro_gestiones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gestion_establecimiento ge
      WHERE ge.id = gestion_establecimiento_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "registro_gestiones: update" ON public.registro_gestiones
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestion_establecimiento ge
      WHERE ge.id = registro_gestiones.gestion_establecimiento_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "registro_gestiones: delete" ON public.registro_gestiones
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestion_establecimiento ge
      WHERE ge.id = registro_gestiones.gestion_establecimiento_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );


-- E.5 Observaciones de Gestiones (1:N con registro_gestiones)
CREATE TABLE public.observaciones_gestiones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_gestion_id   uuid NOT NULL REFERENCES public.registro_gestiones(id) ON DELETE CASCADE,
  descripcion           text NOT NULL,
  fecha_planificada     date NOT NULL,
  fecha_cierre          date,
  responsable_cierre_id uuid REFERENCES public.directorio_personas(id) ON DELETE SET NULL,
  evidencia_cierre_url  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.observaciones_gestiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "observaciones_gestiones: select" ON public.observaciones_gestiones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registro_gestiones rg
      JOIN public.gestion_establecimiento ge ON ge.id = rg.gestion_establecimiento_id
      WHERE rg.id = observaciones_gestiones.registro_gestion_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "observaciones_gestiones: insert" ON public.observaciones_gestiones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.registro_gestiones rg
      JOIN public.gestion_establecimiento ge ON ge.id = rg.gestion_establecimiento_id
      WHERE rg.id = registro_gestion_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "observaciones_gestiones: update" ON public.observaciones_gestiones
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registro_gestiones rg
      JOIN public.gestion_establecimiento ge ON ge.id = rg.gestion_establecimiento_id
      WHERE rg.id = observaciones_gestiones.registro_gestion_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "observaciones_gestiones: delete" ON public.observaciones_gestiones
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registro_gestiones rg
      JOIN public.gestion_establecimiento ge ON ge.id = rg.gestion_establecimiento_id
      WHERE rg.id = observaciones_gestiones.registro_gestion_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );
