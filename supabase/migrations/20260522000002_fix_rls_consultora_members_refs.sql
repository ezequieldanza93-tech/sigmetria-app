-- ============================================================
-- Fix RLS policies that still reference the old table name
-- `consultora_members` inside policy bodies (subqueries).
-- The table was renamed to `consultoras_members` in the
-- 20260522000001 migration, but policy bodies were NOT updated.
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  sql_using TEXT;
  sql_check TEXT;
  cmd TEXT;
BEGIN
  FOR rec IN
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      p.polname AS policyname,
      pg_get_expr(p.polqual, p.polrelid) AS using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
      p.polcmd AS cmd
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (
      pg_get_expr(p.polqual, p.polrelid) LIKE '%consultora_members%'
      OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%consultora_members%'
    )
  LOOP
    sql_using := replace(COALESCE(rec.using_expr, 'true'), 'consultora_members', 'consultoras_members');
    sql_check := replace(COALESCE(rec.check_expr, 'true'), 'consultora_members', 'consultoras_members');

    -- Determine the command type for CREATE POLICY
    CASE rec.cmd
      WHEN 'r' THEN cmd := 'FOR SELECT';
      WHEN 'a' THEN cmd := 'FOR INSERT';
      WHEN 'w' THEN cmd := 'FOR UPDATE';
      WHEN 'd' THEN cmd := 'FOR DELETE';
      ELSE cmd := 'FOR ALL';
    END CASE;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I %s USING (%s) WITH CHECK (%s)',
      rec.policyname, rec.schemaname, rec.tablename,
      cmd, sql_using, sql_check
    );

    RAISE NOTICE 'Fixed policy "%" on %.%', rec.policyname, rec.schemaname, rec.tablename;
  END LOOP;
END;
$$;
