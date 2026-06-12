-- CRM panel (app): acceso de lectura/escritura para el staff de Sigmetría + estado de pipeline.
--
-- Las tablas base (leads, lead_magnets, lead_magnet_descargas, consentimientos) se crearon en el
-- esquema CRM consolidado (repo web, migración 20260610000001_crm_web.sql) sobre ESTE mismo
-- proyecto Supabase. Esta migración es ADITIVA e IDEMPOTENTE: agrega la columna de estado del
-- pipeline, la función de gate y las policies de lectura/escritura para usuarios AUTENTICADOS del
-- allowlist (las policies de INSERT anónimo de los formularios web se conservan intactas).

-- 1) Columna de estado del pipeline CRM (nuevo → contactado → en conversación → cliente / descartado)
alter table public.leads add column if not exists estado_crm text not null default 'nuevo';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_estado_crm_chk') then
    alter table public.leads add constraint leads_estado_crm_chk
      check (estado_crm in ('nuevo', 'contactado', 'en_conversacion', 'cliente', 'descartado'));
  end if;
end $$;

create index if not exists idx_leads_estado_crm on public.leads (estado_crm);

-- 2) Gate del CRM: solo staff de Sigmetría (cuentas @sigmetria.app o el fundador).
--    Mismo criterio que el gate de la app (lib/auth/crm-access.ts).
create or replace function public.is_crm_admin()
returns boolean
language sql
stable
as $$
  -- Dominio anclado al final (~ '...$' con el punto escapado) = mismo criterio que endsWith()
  -- en lib/auth/crm-access.ts. NO usar like '%@sigmetria.app%' (eso sí permitiría bypass).
  select coalesce(
    (lower(auth.jwt() ->> 'email') ~ '@sigmetria\.app$')
    or (lower(auth.jwt() ->> 'email') = 'ezequieldanza93@gmail.com'),
    false
  );
$$;

-- 3) Policies para usuarios AUTENTICADOS del allowlist.
--    leads: SELECT + UPDATE (gestión del pipeline). Resto: SELECT (lectura del CRM).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leads' and policyname='crm_admin_select_leads') then
    create policy "crm_admin_select_leads" on public.leads
      for select to authenticated using (public.is_crm_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leads' and policyname='crm_admin_update_leads') then
    create policy "crm_admin_update_leads" on public.leads
      for update to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_magnets' and policyname='crm_admin_select_magnets') then
    create policy "crm_admin_select_magnets" on public.lead_magnets
      for select to authenticated using (public.is_crm_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_magnet_descargas' and policyname='crm_admin_select_descargas') then
    create policy "crm_admin_select_descargas" on public.lead_magnet_descargas
      for select to authenticated using (public.is_crm_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='consentimientos' and policyname='crm_admin_select_consent') then
    create policy "crm_admin_select_consent" on public.consentimientos
      for select to authenticated using (public.is_crm_admin());
  end if;
end $$;
