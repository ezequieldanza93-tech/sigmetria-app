-- ROLLBACK de emergencia: desactiva TODOS los triggers de auditoría (audit_*).
-- Úsese solo si el trigger de auditoría rompe escrituras en prod. Tras esto, prod
-- escribe normal pero SIN auditar, hasta revisar/arreglar fn_audit_trigger.
-- NO borra datos ni objetos: solo desactiva triggers (reversible con ENABLE TRIGGER).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tgname, tgrelid::regclass AS tbl
    FROM pg_trigger
    WHERE tgname LIKE 'audit%' AND NOT tgisinternal
  LOOP
    EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', r.tbl, r.tgname);
    RAISE NOTICE 'trigger desactivado: % en %', r.tgname, r.tbl;
  END LOOP;
END $$;
