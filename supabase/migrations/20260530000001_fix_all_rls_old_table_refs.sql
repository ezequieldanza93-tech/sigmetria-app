-- ============================================================
-- Sigmetría HyS — Fix RLS policies referencing old table names
--
-- Problema:
--   Las tablas fueron renombradas en 20260522000001, pero los
--   bodies de las RLS policies (subqueries en USING/WITH CHECK)
--   siguen referenciando los nombres viejos:
--     sectores_establecimiento → establecimientos_sectores
--     empleado_puesto         → puestos_personas
--     epp_por_puesto          → puestos_epp
--     empleado_documentos     → personas_documentos
--     directorio_personas     → personas_directorio
--     persona_establecimiento → personas_establecimientos
--     organizacion_establecimiento → organizaciones_establecimientos
--
--   Cuando el browser client (con RLS habilitado) ejecuta INSERT/UPDATE
--   en estas tablas, las policies intentan consultar tablas que ya
--   no existen, causando:
--     "new row violates row-level security policy for table X"
--
-- Solución:
--   Dynamic SQL: busca todas las policies con referencias a nombres
--   viejos de tablas y las recrea con los nombres actualizados.
--   Mismo approach que 20260522000002, pero cubriendo TODOS los renames.
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  sql_using TEXT;
  sql_check TEXT;
  cmd_text TEXT;
BEGIN
  FOR rec IN
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      p.polname AS policyname,
      pg_get_expr(p.polqual, p.polrelid) AS using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
      p.polcmd
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    sql_using := COALESCE(rec.using_expr, 'true');
    sql_check := COALESCE(rec.check_expr, 'true');

    -- Saltar si esta policy no tiene referencias a nombres viejos
    IF sql_using NOT LIKE '%sectores_establecimiento%'
       AND sql_using NOT LIKE '%empleado_puesto%'
       AND sql_using NOT LIKE '%epp_por_puesto%'
       AND sql_using NOT LIKE '%empleado_documentos%'
       AND sql_using NOT LIKE '%directorio_personas%'
       AND sql_using NOT LIKE '%persona_establecimiento%'
       AND sql_using NOT LIKE '%organizacion_establecimiento%'
       AND sql_check NOT LIKE '%sectores_establecimiento%'
       AND sql_check NOT LIKE '%empleado_puesto%'
       AND sql_check NOT LIKE '%epp_por_puesto%'
       AND sql_check NOT LIKE '%empleado_documentos%'
       AND sql_check NOT LIKE '%directorio_personas%'
       AND sql_check NOT LIKE '%persona_establecimiento%'
       AND sql_check NOT LIKE '%organizacion_establecimiento%'
    THEN
      CONTINUE;
    END IF;

    -- Reemplazar cada nombre viejo por su versión nueva
    sql_using := replace(sql_using, 'sectores_establecimiento', 'establecimientos_sectores');
    sql_using := replace(sql_using, 'empleado_puesto', 'puestos_personas');
    sql_using := replace(sql_using, 'epp_por_puesto', 'puestos_epp');
    sql_using := replace(sql_using, 'empleado_documentos', 'personas_documentos');
    sql_using := replace(sql_using, 'directorio_personas', 'personas_directorio');
    sql_using := replace(sql_using, 'persona_establecimiento', 'personas_establecimientos');
    sql_using := replace(sql_using, 'organizacion_establecimiento', 'organizaciones_establecimientos');

    sql_check := replace(sql_check, 'sectores_establecimiento', 'establecimientos_sectores');
    sql_check := replace(sql_check, 'empleado_puesto', 'puestos_personas');
    sql_check := replace(sql_check, 'epp_por_puesto', 'puestos_epp');
    sql_check := replace(sql_check, 'empleado_documentos', 'personas_documentos');
    sql_check := replace(sql_check, 'directorio_personas', 'personas_directorio');
    sql_check := replace(sql_check, 'persona_establecimiento', 'personas_establecimientos');
    sql_check := replace(sql_check, 'organizacion_establecimiento', 'organizaciones_establecimientos');

    -- Eliminar policy vieja
    cmd_text := 'DROP POLICY IF EXISTS ' || quote_ident(rec.policyname)
             || ' ON ' || quote_ident(rec.schemaname) || '.' || quote_ident(rec.tablename) || ';';
    EXECUTE cmd_text;

    -- Recrear con nombres corregidos
    cmd_text := 'CREATE POLICY ' || quote_ident(rec.policyname)
             || ' ON ' || quote_ident(rec.schemaname) || '.' || quote_ident(rec.tablename);

    -- Mapear polcmd: 'r'=SELECT, 'a'=INSERT, 'w'=UPDATE, 'd'=DELETE, '*'=ALL
    IF rec.polcmd = 'r' THEN
      cmd_text := cmd_text || ' FOR SELECT';
    ELSIF rec.polcmd = 'a' THEN
      cmd_text := cmd_text || ' FOR INSERT';
    ELSIF rec.polcmd = 'w' THEN
      cmd_text := cmd_text || ' FOR UPDATE';
    ELSIF rec.polcmd = 'd' THEN
      cmd_text := cmd_text || ' FOR DELETE';
    ELSE
      cmd_text := cmd_text || ' FOR ALL';
    END IF;

    cmd_text := cmd_text || ' TO authenticated';
    cmd_text := cmd_text || ' USING (' || sql_using || ')';

    -- WITH CHECK solo para INSERT/UPDATE (cuando es distinto de USING)
    IF rec.polcmd IN ('a', 'w', '*') AND sql_check != sql_using THEN
      cmd_text := cmd_text || ' WITH CHECK (' || sql_check || ')';
    END IF;

    cmd_text := cmd_text || ';';

    EXECUTE cmd_text;
  END LOOP;

  RAISE NOTICE 'RLS policies with old table references have been fixed.';
END;
$$;
