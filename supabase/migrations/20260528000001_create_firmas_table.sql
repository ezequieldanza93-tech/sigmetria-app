-- ============================================================
-- Sistema de Firmas Electrónicas (Fase 1)
-- ============================================================

CREATE TYPE public.firma_entidad_tipo AS ENUM (
  'gestion', 'capacitacion', 'permiso_trabajo', 'entrega_epp'
);

CREATE TYPE public.firma_firmante_tipo AS ENUM (
  'usuario_interno', 'trabajador'
);

CREATE TABLE public.firmas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id      UUID NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  entidad_tipo       public.firma_entidad_tipo NOT NULL,
  entidad_id         UUID NOT NULL,
  firmante_tipo      public.firma_firmante_tipo NOT NULL,
  firmante_usuario_id UUID REFERENCES public.profiles(id),
  trabajador_id      UUID REFERENCES public.personas_directorio(id),
  nombre_completo    TEXT NOT NULL,
  dni                TEXT NOT NULL,
  rol                TEXT,
  firma_svg_data     TEXT,
  asistente_id       UUID REFERENCES public.profiles(id),
  ip_address         TEXT,
  user_agent         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_firmas_entidad ON public.firmas(entidad_tipo, entidad_id);
CREATE INDEX idx_firmas_consultora ON public.firmas(consultora_id);
CREATE INDEX idx_firmas_created_at ON public.firmas(created_at DESC);

-- RLS
ALTER TABLE public.firmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firmas: select" ON public.firmas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = consultora_id AND cm.user_id = auth.uid() AND cm.is_active = true
  ));

CREATE POLICY "firmas: insert" ON public.firmas FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = consultora_id AND cm.user_id = auth.uid() AND cm.is_active = true
  ));

-- Agregar campo firmada a gestiones_establecimientos
ALTER TABLE public.gestiones_establecimientos
  ADD COLUMN firmada BOOLEAN NOT NULL DEFAULT false;

-- Agregar campo firmada a capacitaciones
ALTER TABLE public.capacitaciones
  ADD COLUMN firmada BOOLEAN NOT NULL DEFAULT false;
