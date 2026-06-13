-- ============================================================
-- Estándar 9 (Autocontrol — SRT Disp. 15/2026): VALIDAR los CHECK constraints que
-- 20260705000001 creó como NOT VALID (validaban solo filas nuevas, no las legacy).
--
-- Validar un constraint escanea las filas existentes: si alguna viola la regla, el
-- VALIDATE falla. Para no abortar la migración por datos legacy de UNA tabla, cada
-- VALIDATE va en su propio subtransaction con manejo de excepción: los constraints con
-- datos limpios quedan VALIDADOS; los que tengan filas que violan se SALTEAN con un
-- NOTICE (quedan NOT VALID, protegiendo igual la carga nueva, hasta limpiar esos datos).
-- Idempotente: VALIDATE sobre un constraint ya validado es no-op.
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('empresas_documentos',        'chk_empresas_doc_fechas_coherentes'),
      ('establecimientos_documentos','chk_estab_doc_fechas_coherentes'),
      ('personas_documentos',        'chk_personas_doc_fechas_coherentes'),
      ('subcontratistas_documentos', 'chk_subc_doc_fechas_coherentes'),
      ('matriculas',                 'chk_matriculas_fechas_coherentes'),
      ('certificados_calibracion',   'chk_certcalib_fechas_coherentes'),
      ('matriculas_profesionales',   'chk_matprof_fechas_coherentes'),
      ('configuracion_vencimientos', 'chk_cv_dias_aviso_positivo'),
      ('inspecciones',               'chk_inspecciones_fechas_coherentes'),
      ('riesgos',                    'chk_riesgos_fechas_coherentes'),
      ('reportes_fotograficos',      'chk_reportes_periodo_coherente')
    ) AS t(tbl, con)
  LOOP
    -- saltear si la tabla o el constraint no existen (defensivo)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = r.tbl AND c.conname = r.con
    ) THEN
      RAISE NOTICE 'autocontrol VALIDATE: % / % no existe — skip', r.tbl, r.con;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', r.tbl, r.con);
      RAISE NOTICE 'autocontrol VALIDATE: ✅ % validado', r.con;
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'autocontrol VALIDATE: ⚠️ % tiene filas legacy que violan — queda NOT VALID (limpiar datos)', r.con;
    END;
  END LOOP;
END $$;
