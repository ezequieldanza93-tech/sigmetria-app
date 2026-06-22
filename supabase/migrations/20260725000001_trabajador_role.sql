-- Nuevo perfil: Trabajador (operario / empleado de la empresa-cliente).
-- Usuario final con identidad verificada (cuenta + MFA). Ve SOLO lo suyo:
-- sus capacitaciones y las entregas de EPP que se le registraron, donde puede
-- dar conformidad o hacer descargo por ítem. NO consume seat del plan.
--
-- ADD VALUE va aislado en su propia migración: Postgres no permite usar un valor
-- de enum recién creado dentro de la misma transacción que lo crea.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'trabajador';
