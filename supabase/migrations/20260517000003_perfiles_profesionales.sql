-- perfiles_profesionales (1:1 with profiles) + matriculas_profesionales (1:N)
-- Separate from directorio_personas — consultora staff are auth users, not client-side people.

-- ============================================================
-- 1. perfiles_profesionales (C1 — management oversight)
-- ============================================================
CREATE TABLE public.perfiles_profesionales (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  telefono                  text,
  fecha_nacimiento          date,
  provincia_residencia      text,
  localidad                 text,
  provincia_matricula       text,
  canal_captacion           text,
  tipo_identidad_impositiva text,
  cuit                      text,
  firma_url                 text,
  logo_small_url            text,
  logo_destacado_url        text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perfiles_profesionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfiles_profesionales: select" ON public.perfiles_profesionales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.consultora_members cm1
      JOIN public.consultora_members cm2
        ON cm1.consultora_id = cm2.consultora_id
      WHERE cm1.user_id = perfiles_profesionales.user_id
        AND cm2.user_id = auth.uid()
        AND cm2.is_active = true
    )
  );

CREATE POLICY "perfiles_profesionales: insert" ON public.perfiles_profesionales
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_developer());

CREATE POLICY "perfiles_profesionales: update" ON public.perfiles_profesionales
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_developer());


-- ============================================================
-- 2. matriculas_profesionales (1:N with perfiles_profesionales)
-- ============================================================
CREATE TABLE public.matriculas_profesionales (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         uuid        NOT NULL REFERENCES public.perfiles_profesionales(id) ON DELETE CASCADE,
  emisor            text        NOT NULL,
  numero            text        NOT NULL,
  fecha_emision     date,
  fecha_vencimiento date,
  foto_frente_url   text,
  foto_dorso_url    text,
  activa            boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.matriculas_profesionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matriculas_profesionales: select" ON public.matriculas_profesionales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.perfiles_profesionales pp
      JOIN public.consultora_members cm1 ON cm1.user_id = pp.user_id
      JOIN public.consultora_members cm2 ON cm2.consultora_id = cm1.consultora_id
      WHERE pp.id = matriculas_profesionales.perfil_id
        AND cm2.user_id = auth.uid()
        AND cm2.is_active = true
    )
  );

CREATE POLICY "matriculas_profesionales: insert" ON public.matriculas_profesionales
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles_profesionales pp
      WHERE pp.id = perfil_id
        AND (pp.user_id = auth.uid() OR is_developer())
    )
  );

CREATE POLICY "matriculas_profesionales: update" ON public.matriculas_profesionales
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles_profesionales pp
      WHERE pp.id = matriculas_profesionales.perfil_id
        AND (pp.user_id = auth.uid() OR is_developer())
    )
  );
