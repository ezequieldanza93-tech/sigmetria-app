-- Restringe el acceso al CRM a un email exacto: admin.main@sigmetria.app.
-- Reemplaza la lógica anterior (dominio @sigmetria.app wildcard + fundador) por un allowlist
-- de un único email. Mismo criterio que lib/auth/crm-access.ts (CRM_ALLOWED_EMAILS).
-- Migración anterior: 20260712000007_crm_panel_acceso.sql (NO modificar).

create or replace function public.is_crm_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') = 'admin.main@sigmetria.app',
    false
  );
$$;
