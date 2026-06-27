-- PART-001: Particiones futuras de audit_log (mensual)
-- Estado actual: solo 202606–202609 + DEFAULT + HISTORICAL
-- Existe DEFAULT → no hay riesgo de fallo de INSERT, pero sin particiones específicas
-- todos los logs de Oct 2026+ van al DEFAULT (menos eficiente, índices más grandes).
-- Se crean particiones para los próximos 15 meses (2026-10 → 2027-12).
-- Compatibilidad: Postgres mueve datos del DEFAULT a la nueva partición automáticamente;
-- como audit_log_default está vacío (no hay datos de fechas futuras aún), es seguro.

CREATE TABLE IF NOT EXISTS public.audit_log_202610
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202611
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202612
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202701
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202702
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202703
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202704
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202705
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202706
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202707
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-07-01 00:00:00+00') TO ('2027-08-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202708
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-08-01 00:00:00+00') TO ('2027-09-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202709
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-09-01 00:00:00+00') TO ('2027-10-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202710
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-10-01 00:00:00+00') TO ('2027-11-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202711
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-11-01 00:00:00+00') TO ('2027-12-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_log_202712
  PARTITION OF public.audit_log
  FOR VALUES FROM ('2027-12-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

-- Próximo paso sugerido: configurar pg_cron o una Edge Function que cree
-- la partición del mes siguiente 1 semana antes de que comience.
-- Ver _auditoria-db/pendientes-decision.md para el approach recomendado.
