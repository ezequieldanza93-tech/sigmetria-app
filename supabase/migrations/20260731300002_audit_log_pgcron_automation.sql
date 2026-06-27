-- Dos correcciones combinadas aplicadas en la misma tanda:

-- ─────────────────────────────────────────────────────────────
-- (A) PART-001: automatización de particiones de audit_log con pg_cron
-- Crea la partición del mes siguiente el día 1 de cada mes a las 00:05 UTC.
-- Buffer de 1 mes adelante → nunca llega al DEFAULT por falta de partición.
-- Requiere extensión pg_cron (disponible en Supabase Pro+, verificado disponible).

SELECT cron.schedule(
  'audit-log-auto-partition',
  '5 0 1 * *',
  $cmd$
    DO $body$
    DECLARE
      target_month date;
      pname  text;
      d_from text;
      d_to   text;
    BEGIN
      target_month := date_trunc('month', now() + interval '1 month');
      pname  := 'audit_log_' || to_char(target_month, 'YYYY_MM');
      d_from := to_char(target_month, 'YYYY-MM-01');
      d_to   := to_char(target_month + interval '1 month', 'YYYY-MM-01');
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = pname
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.audit_log FOR VALUES FROM (%L) TO (%L)',
          pname, d_from, d_to
        );
      END IF;
    END
    $body$;
  $cmd$
);

-- ─────────────────────────────────────────────────────────────
-- (B) FK de tablas financieras sin índice + FKs autoría NOT NULL con SET NULL (contradicción)
-- 14 índices FK que quedaron fuera del sweep inicial (tablas fin_* agregadas después).
-- 3 FKs de autoría NOT NULL que tenían ON DELETE SET NULL → imposible. Política correcta: RESTRICT.

CREATE INDEX IF NOT EXISTS idx_fin_comprobantes_categoria_id ON public.fin_comprobantes (categoria_id);
CREATE INDEX IF NOT EXISTS idx_fin_comprobantes_created_by ON public.fin_comprobantes (created_by);
CREATE INDEX IF NOT EXISTS idx_fin_comprobantes_establecimiento_id ON public.fin_comprobantes (establecimiento_id);
CREATE INDEX IF NOT EXISTS idx_fin_comprobantes_forma_pago_id ON public.fin_comprobantes (forma_pago_id);
CREATE INDEX IF NOT EXISTS idx_fin_cotizaciones_convertida_empresa_id ON public.fin_cotizaciones (convertida_empresa_id);
CREATE INDEX IF NOT EXISTS idx_fin_cotizaciones_created_by ON public.fin_cotizaciones (created_by);
CREATE INDEX IF NOT EXISTS idx_fin_cotizaciones_empresa_id ON public.fin_cotizaciones (empresa_id);
CREATE INDEX IF NOT EXISTS idx_fin_cotizaciones_forma_pago_id ON public.fin_cotizaciones (forma_pago_id);
CREATE INDEX IF NOT EXISTS idx_fin_cotizaciones_lead_id ON public.fin_cotizaciones (lead_id);
CREATE INDEX IF NOT EXISTS idx_fin_gastos_categoria_id ON public.fin_gastos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_fin_gastos_created_by ON public.fin_gastos (created_by);
CREATE INDEX IF NOT EXISTS idx_fin_gastos_establecimiento_id ON public.fin_gastos (establecimiento_id);
CREATE INDEX IF NOT EXISTS idx_fin_inversiones_categoria_id ON public.fin_inversiones (categoria_id);
CREATE INDEX IF NOT EXISTS idx_fin_inversiones_created_by ON public.fin_inversiones (created_by);

ALTER TABLE public.iperc_historial_estados DROP CONSTRAINT IF EXISTS iperc_historial_estados_usuario_id_fkey;
ALTER TABLE public.iperc_historial_estados ADD  CONSTRAINT iperc_historial_estados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.subcontratistas_documentos DROP CONSTRAINT IF EXISTS subcontratistas_documentos_subido_por_fkey;
ALTER TABLE public.subcontratistas_documentos ADD  CONSTRAINT subcontratistas_documentos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.user_access DROP CONSTRAINT IF EXISTS user_access_granted_by_fkey;
ALTER TABLE public.user_access ADD  CONSTRAINT user_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
