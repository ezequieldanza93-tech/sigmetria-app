-- ============================================================
-- Subcontratistas: rubros (catálogo), tabla de extensión y respuestas
-- ============================================================

-- ── 1. subcontratistas_rubros ────────────────────────────────
CREATE TABLE public.subcontratistas_rubros (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subcontratistas_rubros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subcontratistas_rubros: select" ON public.subcontratistas_rubros
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO public.subcontratistas_rubros (nombre) VALUES
  ('Albañilería y Mampostería'),
  ('Ascensores y Montacargas'),
  ('Carpintería y Aberturas'),
  ('Demolición'),
  ('Electricidad'),
  ('Excavaciones y Movimiento de Suelos'),
  ('Herrería y Metalmecánica'),
  ('HVAC y Climatización'),
  ('Impermeabilización y Techado'),
  ('Instalaciones de Gas'),
  ('Medicina Laboral'),
  ('Montaje Industrial'),
  ('Paisajismo y Jardinería'),
  ('Pisos y Revestimientos'),
  ('Pintura'),
  ('Prevención y Lucha contra Incendio'),
  ('Sanitaria y Plomería'),
  ('Seguridad e Higiene'),
  ('Seguridad Electrónica y CCTV'),
  ('Telecomunicaciones y Redes'),
  ('Transporte y Logística'),
  ('Yesería y Revoque');

-- ── 2. subcontratistas (extiende organizaciones_externas) ───
CREATE TABLE public.subcontratistas (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id           uuid NOT NULL UNIQUE
    REFERENCES public.organizaciones_externas(id) ON DELETE CASCADE,
  tipo_identidad_impositiva text CHECK (tipo_identidad_impositiva IN ('CUIT','CUIL','CDI')),
  cuit                      text,
  rubro_id                  uuid REFERENCES public.subcontratistas_rubros(id),
  domicilio                 text,
  localidad_id              uuid REFERENCES public.localidades(id),
  codigo_postal             text,
  art_id                    uuid REFERENCES public.organizaciones_externas(id),
  art_numero_contrato       text,
  tipo_establecimiento_id   uuid REFERENCES public.tipos_establecimiento(id),
  actividad_principal       text,
  cantidad_trabajadores     int,
  informacion_general       text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

ALTER TABLE public.subcontratistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontratistas: select" ON public.subcontratistas
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'developer')
    OR EXISTS (SELECT 1 FROM public.consultora_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "subcontratistas: insert" ON public.subcontratistas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'developer')
    OR EXISTS (
      SELECT 1 FROM public.consultora_members
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('full_access_main','full_access_branch','colaborador')
    )
  );

CREATE POLICY "subcontratistas: update" ON public.subcontratistas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'developer')
    OR EXISTS (
      SELECT 1 FROM public.consultora_members
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('full_access_main','full_access_branch','colaborador')
    )
  );

-- ── 3. subcontratista_respuestas ─────────────────────────────
CREATE TABLE public.subcontratista_respuestas (
  subcontratista_id uuid NOT NULL REFERENCES public.subcontratistas(id) ON DELETE CASCADE,
  pregunta_id       uuid NOT NULL REFERENCES public.preguntas_riesgo(id) ON DELETE CASCADE,
  respuesta         boolean NOT NULL DEFAULT false,
  PRIMARY KEY (subcontratista_id, pregunta_id)
);

ALTER TABLE public.subcontratista_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontratista_respuestas: all" ON public.subcontratista_respuestas
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subcontratistas_organizacion ON public.subcontratistas(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_subcontratistas_rubro ON public.subcontratistas(rubro_id);
CREATE INDEX IF NOT EXISTS idx_subcontratistas_tipo_est ON public.subcontratistas(tipo_establecimiento_id);
