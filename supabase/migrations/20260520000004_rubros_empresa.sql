CREATE TABLE IF NOT EXISTS public.rubros_empresa (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  descripcion text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rubros_empresa_pkey PRIMARY KEY (id),
  CONSTRAINT rubros_empresa_nombre_key UNIQUE (nombre)
);

ALTER TABLE public.rubros_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rubros_empresa: select" ON public.rubros_empresa FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "rubros_empresa: insert" ON public.rubros_empresa FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "rubros_empresa: update" ON public.rubros_empresa FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.documentacion_rubros_empresa (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  documento_tipo_id uuid NOT NULL REFERENCES public.documento_tipos(id) ON DELETE CASCADE,
  rubro_empresa_id  uuid NOT NULL REFERENCES public.rubros_empresa(id) ON DELETE CASCADE,
  aplica_iso_45001  boolean NOT NULL DEFAULT false,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT documentacion_rubros_empresa_pkey PRIMARY KEY (id),
  CONSTRAINT documentacion_rubros_empresa_unique UNIQUE (documento_tipo_id, rubro_empresa_id)
);

ALTER TABLE public.documentacion_rubros_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentacion_rubros_empresa: select" ON public.documentacion_rubros_empresa FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "documentacion_rubros_empresa: insert" ON public.documentacion_rubros_empresa FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "documentacion_rubros_empresa: delete" ON public.documentacion_rubros_empresa FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO public.rubros_empresa (nombre, descripcion) VALUES
  ('Industria / Manufactura', 'Actividades industriales y de transformacion'),
  ('Construccion', 'Empresas constructoras y contratistas de obra'),
  ('Mineria', 'Extraccion y procesamiento de minerales'),
  ('Agropecuario', 'Actividades agricolas, ganaderas y forestales'),
  ('Logistica / Deposito', 'Centros de distribucion, depositos y transporte'),
  ('Comercio / Retail', 'Comercios minoristas y mayoristas'),
  ('Salud', 'Centros de salud, clinicas y hospitales'),
  ('Transporte', 'Empresas de transporte de carga y pasajeros'),
  ('Energia / Petroleo / Gas', 'Exploracion, produccion y distribucion de energia'),
  ('Servicios', 'Empresas de servicios generales y profesionales'),
  ('Educacion', 'Instituciones educativas'),
  ('Gastronomia / Hoteleria', 'Restaurantes, bares, hoteles y alojamiento'),
  ('Administrativo / Oficinas', 'Oficinas administrativas y centros de servicio'),
  ('Tecnologia', 'Empresas de tecnologia, software y telecomunicaciones')
ON CONFLICT (nombre) DO NOTHING;
