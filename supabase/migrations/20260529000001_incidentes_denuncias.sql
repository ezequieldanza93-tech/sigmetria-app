-- ============================================================
-- Sigmetría HyS — Módulo de Incidentes y Denuncias
-- ============================================================

-- ============================================================
-- 1. Tabla incidentes
-- ============================================================
CREATE TABLE public.incidentes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id         UUID NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  empresa_id            UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  establecimiento_id    UUID REFERENCES public.establecimientos(id) ON DELETE SET NULL,
  titulo                TEXT NOT NULL,
  descripcion           TEXT NOT NULL,
  tipo_incidente        TEXT NOT NULL CHECK (tipo_incidente IN (
    'electrico','mecanico','estructural','quimico',
    'ergonomico','ambiental','incendio','caida',
    'herramienta','vehiculo','otro'
  )),
  severidad             TEXT NOT NULL CHECK (severidad IN ('baja','media','alta','critica')),
  lugar_especifico      TEXT,
  fecha_incidente       DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_incidente        TIME,
  involucrados          TEXT,
  testigos              TEXT,
  estado                TEXT NOT NULL DEFAULT 'recibida' CHECK (estado IN (
    'recibida','en_analisis','accion_planificada','implementada','cerrada'
  )),
  historial_estados     JSONB NOT NULL DEFAULT '[]'::jsonb,
  responsable_asignado_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acciones_tomadas      TEXT,
  conclusion            TEXT,
  cerrado_por           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha_cierre          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidentes_consultora ON public.incidentes(consultora_id);
CREATE INDEX idx_incidentes_empresa ON public.incidentes(empresa_id);
CREATE INDEX idx_incidentes_estado ON public.incidentes(estado);
CREATE INDEX idx_incidentes_created_at ON public.incidentes(created_at DESC);
CREATE INDEX idx_incidentes_establecimiento ON public.incidentes(establecimiento_id) WHERE establecimiento_id IS NOT NULL;

-- ============================================================
-- 2. Tabla denuncias
-- ============================================================
CREATE TABLE public.denuncias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id         UUID NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  empresa_id            UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  establecimiento_id    UUID REFERENCES public.establecimientos(id) ON DELETE SET NULL,
  titulo                TEXT NOT NULL,
  descripcion           TEXT NOT NULL,
  tipo_denuncia         TEXT NOT NULL CHECK (tipo_denuncia IN (
    'laboral','acoso','condiciones_inseguras',
    'incumplimiento_normativo','conducta','otro'
  )),
  denunciante_tipo      TEXT NOT NULL CHECK (denunciante_tipo IN ('interno','externo','anonimo')),
  denunciante_nombre    TEXT,
  denunciante_dni       TEXT,
  denunciante_contacto  TEXT,
  fecha_denuncia        DATE NOT NULL DEFAULT CURRENT_DATE,
  involucrados          TEXT,
  estado                TEXT NOT NULL DEFAULT 'recibida' CHECK (estado IN (
    'recibida','en_analisis','accion_planificada','implementada','cerrada'
  )),
  historial_estados     JSONB NOT NULL DEFAULT '[]'::jsonb,
  responsable_asignado_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acciones_tomadas      TEXT,
  conclusion            TEXT,
  confidencial          BOOLEAN NOT NULL DEFAULT false,
  cerrado_por           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha_cierre          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_denuncias_consultora ON public.denuncias(consultora_id);
CREATE INDEX idx_denuncias_empresa ON public.denuncias(empresa_id);
CREATE INDEX idx_denuncias_estado ON public.denuncias(estado);
CREATE INDEX idx_denuncias_created_at ON public.denuncias(created_at DESC);
CREATE INDEX idx_denuncias_establecimiento ON public.denuncias(establecimiento_id) WHERE establecimiento_id IS NOT NULL;

-- ============================================================
-- 3. Tablas de fotos
-- ============================================================
CREATE TABLE public.incidentes_fotos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incidente_id  UUID NOT NULL REFERENCES public.incidentes(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  filename      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidentes_fotos_incidente ON public.incidentes_fotos(incidente_id);

CREATE TABLE public.denuncias_fotos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id   UUID NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  filename      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_denuncias_fotos_denuncia ON public.denuncias_fotos(denuncia_id);

-- ============================================================
-- 4. Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incidentes_updated_at
  BEFORE UPDATE ON public.incidentes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_denuncias_updated_at
  BEFORE UPDATE ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. RLS — incidentes
-- ============================================================
ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidentes: select" ON public.incidentes FOR SELECT
  USING (has_empresa_read_access(empresa_id));

CREATE POLICY "incidentes: insert" ON public.incidentes FOR INSERT
  WITH CHECK (has_empresa_write_access(empresa_id));

CREATE POLICY "incidentes: update" ON public.incidentes FOR UPDATE
  USING (has_empresa_write_access(empresa_id));

CREATE POLICY "incidentes: delete" ON public.incidentes FOR DELETE
  USING (has_empresa_write_access(empresa_id));

-- incidentes_fotos: hereda acceso vía incidente padre
CREATE POLICY "incidentes_fotos: select" ON public.incidentes_fotos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_fotos.incidente_id
      AND has_empresa_read_access(i.empresa_id)
  ));

CREATE POLICY "incidentes_fotos: insert" ON public.incidentes_fotos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidente_id
      AND has_empresa_write_access(i.empresa_id)
  ));

CREATE POLICY "incidentes_fotos: update" ON public.incidentes_fotos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_fotos.incidente_id
      AND has_empresa_write_access(i.empresa_id)
  ));

CREATE POLICY "incidentes_fotos: delete" ON public.incidentes_fotos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_fotos.incidente_id
      AND has_empresa_write_access(i.empresa_id)
  ));

-- ============================================================
-- 6. RLS — denuncias
-- ============================================================
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "denuncias: select" ON public.denuncias FOR SELECT
  USING (has_empresa_read_access(empresa_id));

CREATE POLICY "denuncias: insert" ON public.denuncias FOR INSERT
  WITH CHECK (has_empresa_write_access(empresa_id));

CREATE POLICY "denuncias: update" ON public.denuncias FOR UPDATE
  USING (has_empresa_write_access(empresa_id));

CREATE POLICY "denuncias: delete" ON public.denuncias FOR DELETE
  USING (has_empresa_write_access(empresa_id));

-- denuncias_fotos: hereda acceso vía denuncia padre
CREATE POLICY "denuncias_fotos: select" ON public.denuncias_fotos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_fotos.denuncia_id
      AND has_empresa_read_access(d.empresa_id)
  ));

CREATE POLICY "denuncias_fotos: insert" ON public.denuncias_fotos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncia_id
      AND has_empresa_write_access(d.empresa_id)
  ));

CREATE POLICY "denuncias_fotos: update" ON public.denuncias_fotos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_fotos.denuncia_id
      AND has_empresa_write_access(d.empresa_id)
  ));

CREATE POLICY "denuncias_fotos: delete" ON public.denuncias_fotos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_fotos.denuncia_id
      AND has_empresa_write_access(d.empresa_id)
  ));

-- ============================================================
-- 7. Storage buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('incidentes', 'incidentes', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic']),
  ('denuncias', 'denuncias', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: solo usuarios con acceso a la empresa pueden operar
CREATE POLICY "incidentes storage: select" ON storage.objects FOR SELECT
  USING (bucket_id = 'incidentes' AND has_empresa_read_access(
    (SELECT empresa_id FROM public.incidentes WHERE id::text = (storage.foldername(objects.name))[2])
  ));

CREATE POLICY "incidentes storage: insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'incidentes' AND has_empresa_write_access(
    (SELECT empresa_id FROM public.incidentes WHERE id::text = (storage.foldername(name))[2])
  ));

CREATE POLICY "incidentes storage: delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'incidentes' AND has_empresa_write_access(
    (SELECT empresa_id FROM public.incidentes WHERE id::text = (storage.foldername(objects.name))[2])
  ));

CREATE POLICY "denuncias storage: select" ON storage.objects FOR SELECT
  USING (bucket_id = 'denuncias' AND has_empresa_read_access(
    (SELECT empresa_id FROM public.denuncias WHERE id::text = (storage.foldername(objects.name))[2])
  ));

CREATE POLICY "denuncias storage: insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'denuncias' AND has_empresa_write_access(
    (SELECT empresa_id FROM public.denuncias WHERE id::text = (storage.foldername(name))[2])
  ));

CREATE POLICY "denuncias storage: delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'denuncias' AND has_empresa_write_access(
    (SELECT empresa_id FROM public.denuncias WHERE id::text = (storage.foldername(objects.name))[2])
  ));

-- ============================================================
-- 8. Comments
-- ============================================================
COMMENT ON TABLE public.incidentes IS 'Casi-accidentes y eventos sin lesión con seguimiento de estados';
COMMENT ON TABLE public.denuncias IS 'Reclamos formales, reportes de acoso, condiciones inseguras, etc.';
COMMENT ON TABLE public.incidentes_fotos IS 'Fotos asociadas a un incidente';
COMMENT ON TABLE public.denuncias_fotos IS 'Fotos asociadas a una denuncia';
