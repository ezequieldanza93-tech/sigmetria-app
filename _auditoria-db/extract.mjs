// Extracción del esquema vivo de Supabase (sigmetría) vía Management API.
// Escribe _auditoria-db/schema.json con todo lo necesario para la auditoría.
import { writeFileSync, mkdirSync } from 'node:fs'

const token = 'sbp_9852fc06dbed30f7f5937feb37fac608c36e6538'
const ref = 'lslzhgmoaxgkcjeweqaz'
const URL = `https://api.supabase.com/v1/projects/${ref}/database/query`

async function q(sql) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (r.status !== 201 && r.status !== 200) {
    throw new Error(`SQL ${r.status}: ${await r.text()}\n--- ${sql.slice(0, 120)}`)
  }
  return r.json()
}

const queries = {
  tables: `
    SELECT c.relname AS name,
           COALESCE(s.n_live_tup, 0)::bigint AS rows,
           pg_total_relation_size(c.oid) AS bytes,
           pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
           c.relrowsecurity AS rls,
           obj_description(c.oid) AS comment
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname='public' AND c.relkind='r'
    ORDER BY c.relname;`,
  columns: `
    SELECT table_name, column_name, ordinal_position,
           data_type, udt_name, is_nullable, column_default,
           character_maximum_length, numeric_precision
    FROM information_schema.columns
    WHERE table_schema='public'
    ORDER BY table_name, ordinal_position;`,
  pks: `
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
    WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='public';`,
  fks: `
    SELECT con.conrelid::regclass::text AS table_name,
           att.attname AS column_name,
           cl.relname AS ref_table,
           att2.attname AS ref_column,
           CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS delete_rule
    FROM pg_constraint con
    JOIN pg_namespace n ON n.oid=con.connamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=k.attnum
    JOIN pg_class cl ON cl.oid=con.confrelid
    JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord=k.ord
    JOIN pg_attribute att2 ON att2.attrelid=con.confrelid AND att2.attnum=fk.attnum
    WHERE con.contype='f' AND n.nspname='public'
    ORDER BY table_name, column_name;`,
  uniques: `
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
    WHERE tc.constraint_type='UNIQUE' AND tc.table_schema='public';`,
  indexes: `
    SELECT tablename AS table_name, indexname, indexdef
    FROM pg_indexes WHERE schemaname='public';`,
  enums: `
    SELECT t.typname AS enum_name, e.enumlabel AS label, e.enumsortorder
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid=t.oid
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public'
    ORDER BY t.typname, e.enumsortorder;`,
  checks: `
    SELECT tc.table_name, cc.constraint_name, cc.check_clause
    FROM information_schema.check_constraints cc
    JOIN information_schema.table_constraints tc
      ON tc.constraint_name=cc.constraint_name AND tc.constraint_schema=cc.constraint_schema
    WHERE tc.table_schema='public' AND tc.constraint_type='CHECK'
      AND cc.check_clause NOT LIKE '%IS NOT NULL';`,
  views: `
    SELECT table_name AS name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name;`,
  functions: `
    SELECT p.proname AS name, pg_get_function_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' ORDER BY p.proname;`,
  migrations: `
    SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;`,
}

const out = {}
for (const [k, sql] of Object.entries(queries)) {
  try {
    out[k] = await q(sql)
    console.log(`${k}: ${Array.isArray(out[k]) ? out[k].length : '?'} filas`)
  } catch (e) {
    console.error(`ERROR en ${k}:`, e.message)
    out[k] = []
  }
}

mkdirSync('c:/dev/sigmetria-app/_auditoria-db', { recursive: true })
writeFileSync('c:/dev/sigmetria-app/_auditoria-db/schema.json', JSON.stringify(out, null, 2))

// Resumen
const totalRows = out.tables.reduce((a, t) => a + Number(t.rows), 0)
console.log('\n=== RESUMEN ===')
console.log('Tablas:', out.tables.length)
console.log('Columnas:', out.columns.length)
console.log('FKs:', out.fks.length)
console.log('Índices:', out.indexes.length)
console.log('Enums:', new Set(out.enums.map(e => e.enum_name)).size)
console.log('Vistas:', out.views.length)
console.log('Funciones:', out.functions.length)
console.log('Migraciones en ledger:', out.migrations.length)
console.log('Filas totales (aprox):', totalRows)
