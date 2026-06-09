#!/usr/bin/env node
// Importador de la librería de Normativa Legal (RRLL).
// Lee el catálogo limpio exportado de Airtable, normaliza y emite una migración
// seed con los INSERT (categorías -> normas -> requisitos).
//
// Uso:
//   node scripts/import-normativa.mjs [rutaJson] [rutaSalida]
//
// Defaults:
//   rutaJson    -> el export de Airtable en tool-results
//   rutaSalida  -> supabase/migrations/20260628000002_normativa_legal_seed.sql
//
// Notas:
// - Los UUID son DETERMINÍSTICOS (UUIDv5 sobre el record-id de Airtable), así
//   que re-correr el script produce el mismo SQL y los mismos IDs.
// - consultora_id = NULL en todo (catálogo base nacional compartido).

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const DEFAULT_JSON =
  'C:/Users/pherr/.claude/projects/c--dev-sigmetria-app/6c548df3-7cf1-44f6-be7a-d66fc66f620c/tool-results/rrll-export.json';
const DEFAULT_OUT = join(
  repoRoot,
  'supabase',
  'migrations',
  '20260628000002_normativa_legal_seed.sql',
);

const jsonPath = process.argv[2] || DEFAULT_JSON;
const outPath = process.argv[3] || DEFAULT_OUT;

// ---- UUIDv5 determinístico (namespace fijo) ----------------------------
// Namespace arbitrario pero estable para esta librería.
const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'; // namespace URL estándar

function uuidv5(name) {
  const nsBytes = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = createHash('sha1')
    .update(Buffer.concat([nsBytes, nameBytes]))
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---- Helpers SQL --------------------------------------------------------
function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v);
  if (s.trim() === '') return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}
function sqlInt(v) {
  if (v === null || v === undefined || String(v).trim() === '') return 'NULL';
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? String(n) : 'NULL';
}

// ---- Normalización ------------------------------------------------------
function deriveAmbito(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('provincial')) return 'Provincial';
  if (n.includes('municipal') || n.includes('ordenanza')) return 'Municipal';
  if (
    n.includes('otros requisitos') ||
    n.includes('voluntarios') ||
    n.includes('interno')
  )
    return 'Interno';
  return 'Nacional';
}

function cleanCategoriaNombre(nombre) {
  return (nombre || '')
    .replace(/^\d+\s+/, '') // saca prefijo numérico inicial
    .replace(/Resoluciónes/g, 'Resoluciones')
    .replace(/Resoluciones/g, 'Resoluciones')
    .trim();
}

const TIPO_VALIDOS = new Set([
  'Ley',
  'Decreto',
  'Resolución',
  'Disposición',
  'Laudo',
  'Reglamento',
  'Otro',
]);
function normalizeTipo(tipo) {
  const t = (tipo || '').trim();
  if (TIPO_VALIDOS.has(t)) return t;
  return 'Otro'; // "Otros", "Ordenanza", etc.
}

function buildNombreCompleto({ tipo, organismo, numero, anio }) {
  let s = tipo || '';
  if (organismo && String(organismo).trim()) s += ` ${String(organismo).trim()}`;
  if (numero && String(numero).trim()) s += ` ${String(numero).trim()}`;
  if (anio && String(anio).trim()) s += `/${String(anio).trim()}`;
  return s.trim();
}

// ---- Carga --------------------------------------------------------------
const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
const { categorias = [], normas = [], requisitos = [] } = raw;

const warnings = [];

// ---- Mapeos rec-id -> uuid ----------------------------------------------
const catUuid = new Map(); // rec -> uuid
const catAmbito = new Map(); // rec -> ambito
const normaUuid = new Map(); // rec -> uuid

// ---- CATEGORIAS ----------------------------------------------------------
const catRows = categorias.map((c, i) => {
  const id = uuidv5(`cat:${c.id}`);
  catUuid.set(c.id, id);
  const nombre = cleanCategoriaNombre(c.nombre);
  const ambito = deriveAmbito(c.nombre);
  catAmbito.set(c.id, ambito);
  return { id, recId: c.id, nombre, ambito, orden: i + 1 };
});

// ---- NORMAS --------------------------------------------------------------
const normaRows = normas.map((n, i) => {
  const id = uuidv5(`norma:${n.id}`);
  normaUuid.set(n.id, id);

  const categoria_id = catUuid.get(n.categoria_id) || null;
  if (n.categoria_id && !categoria_id) {
    warnings.push(`Norma ${n.id} referencia categoria inexistente ${n.categoria_id}`);
  }

  const tipo = normalizeTipo(n.tipo);
  if (tipo === 'Otro' && (n.tipo || '').trim() && (n.tipo || '').trim() !== 'Otro') {
    warnings.push(`Norma ${n.id}: tipo "${n.tipo}" mapeado a "Otro"`);
  }

  // ambito heredado de la categoría
  const ambito = n.categoria_id ? catAmbito.get(n.categoria_id) || 'Nacional' : 'Nacional';

  const nombre_completo = buildNombreCompleto({
    tipo,
    organismo: n.organismo,
    numero: n.numero,
    anio: n.anio,
  });

  let estado = (n.estado || 'Vigente').trim();
  if (!['Vigente', 'Modificada', 'Derogada'].includes(estado)) {
    warnings.push(`Norma ${n.id}: estado "${n.estado}" desconocido, forzado a Vigente`);
    estado = 'Vigente';
  }

  return {
    id,
    recId: n.id,
    categoria_id,
    tipo,
    numero: n.numero,
    anio: n.anio,
    titulo: n.titulo,
    nombre_completo,
    organismo: n.organismo,
    ambito,
    url_oficial: n.url,
    estado,
    modificaciones: n.modificaciones,
    orden: i + 1,
  };
});

// ---- REQUISITOS ----------------------------------------------------------
const ordenPorNorma = new Map();
const reqRows = [];
let reqHuérfanos = 0;
for (const r of requisitos) {
  const norma_id = normaUuid.get(r.norma_id) || null;
  if (!norma_id) {
    reqHuérfanos++;
    warnings.push(`Requisito ${r.id} referencia norma inexistente ${r.norma_id} — OMITIDO`);
    continue;
  }
  const orden = (ordenPorNorma.get(r.norma_id) || 0) + 1;
  ordenPorNorma.set(r.norma_id, orden);
  reqRows.push({
    id: uuidv5(`req:${r.id}`),
    recId: r.id,
    norma_id,
    articulo: r.articulo,
    descripcion_corta: r.descripcion_corta,
    descripcion_oficial: r.descripcion_oficial,
    code: r.code,
    orden,
  });
}

// ---- Emitir SQL ----------------------------------------------------------
const lines = [];
lines.push('-- Seed de la librería de Normativa Legal (RRLL) — base nacional compartida.');
lines.push('-- Generado por scripts/import-normativa.mjs (NO editar a mano).');
lines.push('-- consultora_id = NULL en todo (catálogo base). UUIDs determinísticos (uuidv5 sobre airtable_id).');
lines.push('');
lines.push(`-- Conteos: ${catRows.length} categorías / ${normaRows.length} normas / ${reqRows.length} requisitos`);
lines.push('');
lines.push('begin;');
lines.push('');

// Categorias
lines.push('insert into public.normativa_categorias (id, consultora_id, nombre, ambito, orden) values');
lines.push(
  catRows
    .map(
      (c) =>
        `  (${sqlStr(c.id)}, NULL, ${sqlStr(c.nombre)}, ${sqlStr(c.ambito)}, ${sqlInt(c.orden)})`,
    )
    .join(',\n') + ';',
);
lines.push('');

// Normas
lines.push(
  'insert into public.normativa_normas (id, consultora_id, categoria_id, tipo, numero, anio, titulo, nombre_completo, organismo, ambito, url_oficial, estado, modificaciones, airtable_id, orden) values',
);
lines.push(
  normaRows
    .map(
      (n) =>
        `  (${sqlStr(n.id)}, NULL, ${n.categoria_id ? sqlStr(n.categoria_id) : 'NULL'}, ${sqlStr(n.tipo)}, ${sqlStr(n.numero)}, ${sqlInt(n.anio)}, ${sqlStr(n.titulo)}, ${sqlStr(n.nombre_completo)}, ${sqlStr(n.organismo)}, ${sqlStr(n.ambito)}, ${sqlStr(n.url_oficial)}, ${sqlStr(n.estado)}, ${sqlStr(n.modificaciones)}, ${sqlStr(n.recId)}, ${sqlInt(n.orden)})`,
    )
    .join(',\n') + ';',
);
lines.push('');

// Requisitos
lines.push(
  'insert into public.normativa_requisitos (id, norma_id, articulo, descripcion_corta, descripcion_oficial, code, airtable_id, orden) values',
);
lines.push(
  reqRows
    .map(
      (r) =>
        `  (${sqlStr(r.id)}, ${sqlStr(r.norma_id)}, ${sqlStr(r.articulo)}, ${sqlStr(r.descripcion_corta)}, ${sqlStr(r.descripcion_oficial)}, ${sqlStr(r.code)}, ${sqlStr(r.recId)}, ${sqlInt(r.orden)})`,
    )
    .join(',\n') + ';',
);
lines.push('');
lines.push('commit;');
lines.push('');

writeFileSync(outPath, lines.join('\n'), 'utf8');

// ---- Reporte ------------------------------------------------------------
console.log('=== IMPORT NORMATIVA ===');
console.log(`JSON:   ${jsonPath}`);
console.log(`Salida: ${outPath}`);
console.log(`Categorías: ${catRows.length}`);
console.log(`Normas:     ${normaRows.length}`);
console.log(`Requisitos: ${reqRows.length} (omitidos por huérfanos: ${reqHuérfanos})`);
console.log('');
console.log('Categorías normalizadas:');
for (const c of catRows) console.log(`  [${c.ambito}] ${c.nombre}`);
console.log('');
console.log('Ejemplos nombre_completo:');
for (const n of normaRows.slice(0, 5)) console.log(`  ${n.nombre_completo}`);
console.log('');
if (warnings.length) {
  console.log(`WARNINGS (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
} else {
  console.log('Sin warnings.');
}
