-- ============================================================
-- Sigmetria App — Initial Schema
-- ============================================================

-- Enums
CREATE TYPE public.system_role AS ENUM (
  'developer',
  'user'
);

CREATE TYPE public.user_role AS ENUM (
  'full_access_main',
  'full_access_branch',
  'colaborador',
  'full_viewer',
  'colaborador_viewer'
);

-- ============================================================
-- profiles — extiende auth.users
-- ============================================================
CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  avatar_url   text,
  system_role  public.system_role NOT NULL DEFAULT 'user',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ============================================================
-- consultoras — las firmas de HyS que usan la app
-- ============================================================
CREATE TABLE public.consultoras (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  cuit        text UNIQUE,
  telefono    text,
  email       text,
  logo_url    text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- consultora_members — membresía y rol de cada usuario en una consultora
-- ============================================================
CREATE TABLE public.consultora_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id  uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role           public.user_role NOT NULL,
  is_active      boolean DEFAULT true,
  invited_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(consultora_id, user_id)
);

-- ============================================================
-- empresas — clientes de cada consultora
-- ============================================================
CREATE TABLE public.empresas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id  uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  razon_social   text NOT NULL,
  cuit           text,
  rubro          text,
  domicilio      text,
  localidad      text,
  provincia      text,
  codigo_postal  text,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ============================================================
-- establecimientos — plantas / sedes de cada empresa
-- ============================================================
CREATE TABLE public.establecimientos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  domicilio             text,
  localidad             text,
  provincia             text,
  codigo_postal         text,
  actividad_principal   text,
  cantidad_trabajadores int,
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ============================================================
-- user_access — control granular para colaboradores
-- establecimiento_id NULL  = acceso a toda la empresa
-- establecimiento_id SET   = acceso solo a ese establecimiento
-- ============================================================
CREATE TABLE public.user_access (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id         uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  establecimiento_id    uuid REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  granted_by            uuid NOT NULL REFERENCES public.profiles(id),
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(user_id, empresa_id, establecimiento_id)
);

-- ============================================================
-- Row Level Security — habilitado en todas las tablas
-- Las policies se agregan en migraciones separadas
-- ============================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultoras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultora_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establecimientos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Trigger: auto-crear profile cuando se registra un usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
