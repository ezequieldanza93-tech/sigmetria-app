-- ============================================================================
-- WEB AUTH + COMENTARIOS DE BLOG — Sigmetría HyS
--
-- Extiende el CRM web (20260610000001_crm_web.sql) con:
--   1. auth_user_id en leads y lead_magnet_descargas
--      → vincula cada fila al usuario de Supabase Auth
--   2. RPC link_lead_to_auth_user(p_email) — SECURITY DEFINER
--      → el cliente web la llama después del magic-link sign-in
--   3. tabla blog_comments con RLS de moderación
--      → anon INSERT, SELECT solo aprobados, CRM admin aprueba
--
-- 100% ADITIVO e IDEMPOTENTE sobre prod.
-- ============================================================================

-- ── 1. auth_user_id en leads ─────────────────────────────────────────────────
alter table public.leads
  add column if not exists auth_user_id uuid references auth.users(id);

create index if not exists idx_leads_auth_user_id
  on public.leads(auth_user_id);

-- ── 2. auth_user_id en lead_magnet_descargas ─────────────────────────────────
alter table public.lead_magnet_descargas
  add column if not exists auth_user_id uuid references auth.users(id);

create index if not exists idx_lmd_auth_user_id
  on public.lead_magnet_descargas(auth_user_id);

-- ── 3. RLS: usuario web autenticado ve su propio lead ────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'leads' and policyname = 'web user select own lead'
  ) then
    create policy "web user select own lead" on public.leads
      for select to authenticated
      using (auth.uid() = auth_user_id);
  end if;
end $$;

-- ── 4. RLS: usuario autenticado puede insertar y ver sus propias descargas ───
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'lead_magnet_descargas'
      and policyname = 'auth insert descargas'
  ) then
    -- Permite insertar con su propio auth_user_id (o NULL para compat anon)
    create policy "auth insert descargas" on public.lead_magnet_descargas
      for insert to authenticated
      with check (auth_user_id is null or auth.uid() = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'lead_magnet_descargas'
      and policyname = 'web user select own descargas'
  ) then
    create policy "web user select own descargas" on public.lead_magnet_descargas
      for select to authenticated
      using (auth.uid() = auth_user_id or public.is_crm_admin());
  end if;
end $$;

-- ── 5. RPC link_lead_to_auth_user ────────────────────────────────────────────
-- El cliente web llama esta función justo después del SIGNED_IN del magic link.
-- Actualiza el lead cuyo email coincide y todavía no tiene auth_user_id.
-- SECURITY DEFINER = corre como el dueño de la función (bypasa RLS para el UPDATE).
create or replace function public.link_lead_to_auth_user(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads
  set
    auth_user_id     = auth.uid(),
    ultima_actividad_at = now()
  where lower(email) = lower(p_email)
    and auth_user_id is null;
end;
$$;

-- ── 6. blog_comments ─────────────────────────────────────────────────────────
create table if not exists public.blog_comments (
  id           uuid        primary key default gen_random_uuid(),
  post_slug    text        not null,
  nombre       text        not null check (length(nombre) between 2 and 100),
  email        text        not null,
  texto        text        not null check (length(texto) between 10 and 1000),
  aprobado     boolean     not null default false,
  auth_user_id uuid        references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_comments_slug
  on public.blog_comments(post_slug);
create index if not exists idx_comments_slug_aprobado
  on public.blog_comments(post_slug, aprobado);

alter table public.blog_comments enable row level security;

do $$ begin
  -- Anon puede insertar (formulario sin sesión)
  if not exists (
    select 1 from pg_policies
    where tablename = 'blog_comments' and policyname = 'anon insert comment'
  ) then
    create policy "anon insert comment" on public.blog_comments
      for insert to anon with check (true);
  end if;

  -- Autenticado puede insertar
  if not exists (
    select 1 from pg_policies
    where tablename = 'blog_comments' and policyname = 'auth insert comment'
  ) then
    create policy "auth insert comment" on public.blog_comments
      for insert to authenticated with check (true);
  end if;

  -- Anon solo ve comentarios aprobados
  if not exists (
    select 1 from pg_policies
    where tablename = 'blog_comments' and policyname = 'anon select approved'
  ) then
    create policy "anon select approved" on public.blog_comments
      for select to anon using (aprobado = true);
  end if;

  -- Autenticado: aprobados + los propios + admin ve todos
  if not exists (
    select 1 from pg_policies
    where tablename = 'blog_comments' and policyname = 'auth select comments'
  ) then
    create policy "auth select comments" on public.blog_comments
      for select to authenticated
      using (
        aprobado = true
        or auth.uid() = auth_user_id
        or public.is_crm_admin()
      );
  end if;

  -- CRM admin puede actualizar (para aprobar/rechazar)
  if not exists (
    select 1 from pg_policies
    where tablename = 'blog_comments' and policyname = 'crm admin update comments'
  ) then
    create policy "crm admin update comments" on public.blog_comments
      for update to authenticated
      using (public.is_crm_admin())
      with check (public.is_crm_admin());
  end if;
end $$;
