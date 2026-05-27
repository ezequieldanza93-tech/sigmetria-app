-- ============================================================
-- Sigmetría HyS — Agrega max_viewers a tabla plans
-- ============================================================

alter table public.plans
  add column max_viewers integer;

comment on column public.plans.max_viewers is 'Máximo de viewers permitidos en este plan. NULL = ilimitado.';

update public.plans
  set max_viewers = case
    when slug = 'trial'                     then 0
    when slug = 'profesional-independiente' then 2
    when slug = 'consultora-chica'          then 6
    when slug = 'consultora-grande'         then 10
  end
  where slug in ('trial', 'profesional-independiente', 'consultora-chica', 'consultora-grande');
