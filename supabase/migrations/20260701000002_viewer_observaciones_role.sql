-- Nuevo perfil: Viewer de Observaciones (trabajador / capataz / supervisor de sector).
-- Ve y cierra SOLO las observaciones donde figura como responsable. Sin cargo.
--
-- ADD VALUE va aislado en su propia migración: Postgres no permite usar un valor
-- de enum recién creado dentro de la misma transacción que lo crea.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'viewer_observaciones';
