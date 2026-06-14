-- check_email_registered: callable desde anon (sin exponer auth.users directamente)
-- Usada en acceso.astro para decidir si mostrar password step o crear cuenta via OTP.
create or replace function public.check_email_registered(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from auth.users
    where lower(email) = lower(p_email)
  );
$$;

grant execute on function public.check_email_registered(text) to anon, authenticated;
