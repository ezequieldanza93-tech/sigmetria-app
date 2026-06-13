-- ============================================================================
-- WEB PROFILES + ONBOARDING — Sigmetría HyS
--
-- Tabla de perfil para usuarios de la web pública (blog, descargas, comentarios).
-- Separada de `leads` para no contaminar el CRM con datos de perfil educativo/laboral.
-- El CRM cruza ambas por email cuando necesita el perfil completo.
--
-- 100% ADITIVO e IDEMPOTENTE.
-- ============================================================================

-- ── 1. Tabla web_profiles ────────────────────────────────────────────────────
create table if not exists public.web_profiles (
  auth_user_id          uuid         primary key references auth.users(id) on delete cascade,
  email                 text         not null,
  nombre                text,
  -- onboarding: cómo gestiona hoy
  perfil_gestion        text,        -- 'excel' | 'papel' | 'app_terceros' | 'sistema_propio' | 'nada'
  -- onboarding: herramientas conocidas
  perfil_competidores   text[],
  -- onboarding: tipo de trabajo
  perfil_tipo_trabajo   text,        -- 'independiente' | 'consultora' | 'dependencia'
  -- onboarding: formación
  perfil_nivel_estudio  text,        -- 'estudiando' | 'tecnico' | 'licenciado' | 'posgrado'
  -- onboarding: ubicación
  perfil_pais           text         not null default 'Argentina',
  perfil_provincia      text,
  perfil_localidad      text,
  -- onboarding: datos personales
  perfil_fecha_nac      date,
  -- onboarding: texto libre
  perfil_descripcion    text         check (perfil_descripcion is null or length(perfil_descripcion) <= 1000),
  -- estado del onboarding
  onboarding_completado boolean      not null default false,
  created_at            timestamptz  not null default now(),
  updated_at            timestamptz  not null default now()
);

create index if not exists idx_web_profiles_email on public.web_profiles(email);

alter table public.web_profiles enable row level security;

-- ── 2. RLS policies ──────────────────────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'web_profiles' and policyname = 'web user manage own profile'
  ) then
    create policy "web user manage own profile" on public.web_profiles
      for all to authenticated
      using  (auth.uid() = auth_user_id)
      with check (auth.uid() = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'web_profiles' and policyname = 'crm admin read web profiles'
  ) then
    create policy "crm admin read web profiles" on public.web_profiles
      for select to authenticated
      using (public.is_crm_admin());
  end if;
end $$;

-- ── 3. RPC upsert_web_profile ─────────────────────────────────────────────────
-- Llamado inmediatamente después del SIGNED_IN del magic-link.
-- Crea el perfil si no existe; si ya existe, solo actualiza email/nombre si están vacíos.
-- SECURITY DEFINER para poder hacer el upsert incluso desde anon si fuera necesario.
create or replace function public.upsert_web_profile(
  p_email  text,
  p_nombre text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.web_profiles (auth_user_id, email, nombre)
  values (auth.uid(), p_email, p_nombre)
  on conflict (auth_user_id) do update
    set
      email      = excluded.email,
      nombre     = coalesce(web_profiles.nombre, excluded.nombre),
      updated_at = now();
end;
$$;
