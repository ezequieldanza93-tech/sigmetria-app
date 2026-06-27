// Genera un HTML dinámico autocontenido con la auditoría de la base.
// Consume schema.json + report-dead.json + report-3nf.json.
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'c:/dev/sigmetria-app/_auditoria-db'
const schema = JSON.parse(readFileSync(`${DIR}/schema.json`, 'utf8'))
const dead = JSON.parse(readFileSync(`${DIR}/report-dead.json`, 'utf8'))
const tnf = JSON.parse(readFileSync(`${DIR}/report-3nf.json`, 'utf8'))

// ── Clasificador por función (regla ordenada: primer match gana) ──────────────
const REGLAS = [
  [/^_backup_/, 'Backups / temporales'],
  [/^(agent_|sigia_)/, 'Agente IA (SIGIA)'],
  [/^(audit_log|audit_chain|cron_jobs_log|export_jobs|impersonation_log|api_keys|archivos)/, 'Sistema / Auditoría'],
  [/^(notificaciones|alertas|feedback|asistencia_diaria)/, 'Sistema / Auditoría'],
  [/^(plans?$|plan_features|subscription|payment|manual_payments|gifted_plans|mercadopago|founder_review)/, 'Billing / Suscripciones'],
  [/^(leads?$|lead_magnet|blog_comments|web_profiles)/, 'CRM / Marketing'],
  [/^contenido_/, 'Contenido (redes)'],
  [/^(curso|cursos|capacitacion)/, 'Capacitaciones / Cursos'],
  [/^(scraper_|producto|productos)/, 'EPP / Productos (catálogo)'],
  [/^(entregas_epp|puestos_epp)/, 'EPP / Entregas'],
  [/^iperc_/, 'IPERC / Riesgos'],
  [/^(riesgos|medidas_control|incidentes|denuncias|inspecciones)/, 'IPERC / Riesgos'],
  [/^(medicion_|mediciones|calculo_carga_fuego|ergonomia_|protocolo_|reportes_fotograficos|certificados_calibracion|ct_tm_|ct_var_|dec351_)/, 'Mediciones / Protocolos'],
  [/^sap_/, 'Autoprotección (SAP)'],
  [/^(normativa_|documentos_tipos|configuracion_vencimientos)/, 'Normativa / Legal'],
  [/^(gestiones|formularios_|observaciones_)/, 'Gestiones / Agenda'],
  [/^(profiles$|user_access|user_dashboard|mfa_|email_change|verificacion_tokens|consentimientos|legajo_qr|firmas)/, 'Usuarios / Accesos'],
  [/^(consultoras|empresas|establecimientos|organizaciones|subcontratistas|puestos_de_trabajo|personas|perfiles_profesionales|matriculas)/, 'Estructura organizacional'],
  [/^(actividades_economicas|paises|provincias|localidades|colegios_profesionales|unidades|tipos_horas|preguntas_tipos|.*_tipos$|.*_categorias$|.*_clasificaciones$|iperc_niveles|iperc_probabilidades|iperc_consecuencias)/, 'Librerías / Catálogos'],
]
function categoria(name) {
  for (const [re, cat] of REGLAS) if (re.test(name)) return cat
  return 'Otros'
}

// ── Tipo de columna legible ───────────────────────────────────────────────────
function tipoLegible(c) {
  const dt = c.data_type, udt = c.udt_name
  if (dt === 'USER-DEFINED') return `${udt} (enum)`
  if (dt === 'ARRAY') return `${(udt || '').replace(/^_/, '')}[]`
  if (c.character_maximum_length) return `${dt}(${c.character_maximum_length})`
  if (dt === 'numeric' && c.numeric_precision) return `numeric(${c.numeric_precision})`
  return dt
}

// ── Indexar columnas/pks/fks/etc por tabla ────────────────────────────────────
const colsByTable = {}, pkByTable = {}, fkByTable = {}, idxByTable = {}, chkByTable = {}, uqByTable = {}
for (const c of schema.columns) (colsByTable[c.table_name] ??= []).push(c)
for (const p of schema.pks) (pkByTable[p.table_name] ??= new Set()).add(p.column_name)
for (const f of schema.fks) (fkByTable[f.table_name] ??= {})[f.column_name] = `${f.ref_table}.${f.ref_column}`
for (const i of schema.indexes) (idxByTable[i.table_name] ??= []).push(i)
for (const ch of schema.checks) (chkByTable[ch.table_name] ??= []).push(ch)
for (const u of schema.uniques) (uqByTable[u.table_name] ??= new Set()).add(u.column_name)

// ── Armar tablas enriquecidas ─────────────────────────────────────────────────
const tables = schema.tables.map(t => {
  const cols = (colsByTable[t.name] || []).map(c => ({
    name: c.column_name,
    type: tipoLegible(c),
    nullable: c.is_nullable === 'YES',
    default: c.column_default,
    pk: pkByTable[t.name]?.has(c.column_name) || false,
    fk: fkByTable[t.name]?.[c.column_name] || null,
    uq: uqByTable[t.name]?.has(c.column_name) || false,
  }))
  return {
    name: t.name,
    cat: categoria(t.name),
    rows: Number(t.rows),
    size: t.size,
    rls: t.rls,
    comment: t.comment,
    cols,
    nCols: cols.length,
    fks: Object.entries(fkByTable[t.name] || {}).map(([col, ref]) => ({ col, ref })),
    indexes: (idxByTable[t.name] || []).map(i => i.indexdef),
    checks: (chkByTable[t.name] || []).map(c => c.check_clause),
  }
})

// ── Conteos por categoría ─────────────────────────────────────────────────────
const catCount = {}
for (const t of tables) {
  catCount[t.cat] ??= { tablas: 0, filas: 0, columnas: 0 }
  catCount[t.cat].tablas++; catCount[t.cat].filas += t.rows; catCount[t.cat].columnas += t.nCols
}
const categorias = Object.entries(catCount).map(([cat, v]) => ({ cat, ...v })).sort((a, b) => b.tablas - a.tablas)

const meta = {
  tablas: tables.length,
  columnas: schema.columns.length,
  fks: schema.fks.length,
  indices: schema.indexes.length,
  enums: new Set(schema.enums.map(e => e.enum_name)).size,
  vistas: schema.views.length,
  funciones: schema.functions.length,
  filas: tables.reduce((a, t) => a + t.rows, 0),
  migraciones: schema.migrations.length,
  backups: (dead.backupTables || []).length,
  candidatasDesuso: (dead.unusedTables || []).length,
  findings3nf: (tnf.findings || []).length,
  alta: (tnf.findings || []).filter(f => f.severidad === 'alta').length,
}

const DATA = { meta, tables, categorias, dead, tnf, enums: schema.enums, funciones: schema.functions, generado: '2026-06-26' }

// ── HTML ──────────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Auditoría de Base de Datos — Sigmetría HyS</title>
<style>
:root{
  --bg:#0d1117; --panel:#161b22; --panel2:#1c2333; --border:#2d333b; --text:#e6edf3; --muted:#8b949e;
  --brand:#2dd4bf; --brand2:#0ea5e9; --alta:#f85149; --media:#d29922; --baja:#3fb950; --pk:#a371f7; --fk:#58a6ff;
}
*{box-sizing:border-box} html{scroll-behavior:smooth}
body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
header{padding:28px 32px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#0d1117,#161b22)}
header h1{margin:0 0 4px;font-size:24px} header p{margin:0;color:var(--muted);font-size:14px}
.wrap{max-width:1280px;margin:0 auto;padding:24px 32px}
nav{position:sticky;top:0;z-index:20;background:rgba(13,17,23,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--border);padding:10px 32px;display:flex;gap:8px;flex-wrap:wrap}
nav button{background:transparent;border:1px solid var(--border);color:var(--muted);padding:7px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:.15s}
nav button:hover{color:var(--text);border-color:var(--brand)}
nav button.active{background:var(--brand);color:#04201c;border-color:var(--brand)}
section{display:none} section.active{display:block;animation:fade .25s}
@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1}}
h2{font-size:19px;margin:8px 0 16px;border-left:3px solid var(--brand);padding-left:10px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.card .n{font-size:28px;font-weight:700;color:var(--brand)} .card .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.card.warn .n{color:var(--media)} .card.bad .n{color:var(--alta)}
.bar{display:flex;align-items:center;gap:10px;margin:6px 0}
.bar .lab{width:230px;font-size:13px;flex-shrink:0} .bar .track{flex:1;background:var(--panel2);border-radius:6px;height:22px;position:relative;overflow:hidden}
.bar .fill{height:100%;background:linear-gradient(90deg,var(--brand2),var(--brand));border-radius:6px} .bar .val{font-size:12px;color:var(--muted);width:120px;text-align:right}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center}
input[type=text],select{background:var(--panel);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:8px;font-size:14px}
input[type=text]{flex:1;min-width:220px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--border);position:sticky;top:50px;background:var(--bg)}
td{padding:8px 10px;border-bottom:1px solid var(--border)}
tr.tablerow{cursor:pointer} tr.tablerow:hover{background:var(--panel)}
.tag{display:inline-block;font-size:11px;padding:2px 7px;border-radius:20px;background:var(--panel2);color:var(--muted);border:1px solid var(--border)}
.badge{font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:4px}
.badge.pk{background:rgba(163,113,247,.18);color:var(--pk)} .badge.fk{background:rgba(88,166,255,.18);color:var(--fk)} .badge.uq{background:rgba(45,212,191,.16);color:var(--brand)} .badge.null{background:rgba(139,148,158,.15);color:var(--muted)}
.sev{font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px}
.sev.alta{background:rgba(248,81,73,.18);color:var(--alta)} .sev.media{background:rgba(210,153,34,.18);color:var(--media)} .sev.baja{background:rgba(63,185,80,.18);color:var(--baja)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
#overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;z-index:50;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}
#overlay.open{display:flex}
.modal{background:var(--panel);border:1px solid var(--border);border-radius:14px;max-width:1000px;width:100%;padding:0}
.modal .mh{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--border)}
.modal .mh h3{margin:0;font-size:18px;font-family:monospace} .modal .mb{padding:18px 22px;max-height:72vh;overflow:auto}
.close{background:var(--panel2);border:1px solid var(--border);color:var(--text);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:18px}
.finding{background:var(--panel);border:1px solid var(--border);border-left-width:4px;border-radius:10px;padding:14px 16px;margin-bottom:12px}
.finding.alta{border-left-color:var(--alta)} .finding.media{border-left-color:var(--media)} .finding.baja{border-left-color:var(--baja)}
.finding h4{margin:0 0 6px;font-size:15px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.finding .det{color:var(--muted);font-size:13px;margin:6px 0} .finding .rec{font-size:13px;background:var(--panel2);padding:8px 12px;border-radius:8px;margin-top:8px}
.finding .aff{font-family:monospace;font-size:11px;color:var(--fk);margin-top:6px;word-break:break-all}
.muted{color:var(--muted)} code{font-family:monospace;background:var(--panel2);padding:1px 6px;border-radius:4px;font-size:12px}
.notebox{background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin:12px 0;font-size:13px}
details{margin:6px 0} summary{cursor:pointer;font-weight:600}
.mono{font-family:monospace;font-size:12px}
</style>
</head>
<body>
<header>
  <h1>🗄️ Auditoría de Base de Datos — Sigmetría HyS</h1>
  <p>Esquema vivo de Supabase (ref lslzhgmoaxgkcjeweqaz) · generado el ${DATA.generado} · conteos de filas aproximados (n_live_tup)</p>
</header>
<nav>
  <button data-s="resumen" class="active">Resumen</button>
  <button data-s="categorias">Por función</button>
  <button data-s="tablas">Tablas (${meta.tablas})</button>
  <button data-s="desuso">En desuso</button>
  <button data-s="mejoras">3FN & Escalabilidad</button>
</nav>
<div class="wrap">

<section id="resumen" class="active">
  <h2>Resumen general</h2>
  <div class="cards" id="summaryCards"></div>
  <div class="notebox">
    <strong>Lectura rápida.</strong> La base tiene <strong>${meta.tablas} tablas</strong> y <strong>${meta.columnas} columnas</strong>, con disciplina multi-tenant correcta (índice por tenant en las tablas operativas) y particionado declarativo nativo bien hecho en las tablas de alto volumen. Los focos de mejora son: <strong>${DATA.tnf.resumen?.fksSinIndice ?? '—'} FKs sin índice de cobertura</strong> (mayor impacto en escalabilidad), <strong>${meta.backups} tablas de backup</strong> para limpiar, y algunas redundancias 3FN puntuales. No se detectaron columnas muertas (las migraciones ya limpiaron los leftovers).
  </div>
</section>

<section id="categorias">
  <h2>Tablas por función</h2>
  <p class="muted" style="font-size:13px">Agrupación heurística por dominio (primer patrón que matchea el nombre). Click en una categoría para filtrar el listado de tablas.</p>
  <div id="catBars"></div>
</section>

<section id="tablas">
  <h2>Listado de tablas</h2>
  <div class="toolbar">
    <input type="text" id="search" placeholder="Buscar tabla o columna…">
    <select id="catFilter"></select>
    <span class="muted" id="tableCount" style="font-size:13px"></span>
  </div>
  <table>
    <thead><tr><th>Tabla</th><th>Función</th><th>Cols</th><th>Filas</th><th>Tamaño</th><th>RLS</th></tr></thead>
    <tbody id="tableBody"></tbody>
  </table>
</section>

<section id="desuso">
  <h2>Tablas y campos en desuso</h2>
  <div id="deadContent"></div>
</section>

<section id="mejoras">
  <h2>Oportunidades de mejora — 3FN y escalabilidad</h2>
  <div class="cards" id="nfCards"></div>
  <div id="findings"></div>
</section>

</div>

<div id="overlay"><div class="modal">
  <div class="mh"><h3 id="mTitle"></h3><button class="close" onclick="closeModal()">×</button></div>
  <div class="mb" id="mBody"></div>
</div></div>

<script>
const DATA = ${JSON.stringify(DATA)};
const $ = s => document.querySelector(s);
const esc = s => (s==null?'':String(s)).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const fmt = n => n.toLocaleString('es-AR');

// Nav
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('section').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); $('#'+b.dataset.s).classList.add('active'); window.scrollTo(0,0);
});

// Resumen cards
const m=DATA.meta;
const cards=[['Tablas',m.tablas],['Columnas',m.columnas],['Foreign keys',m.fks],['Índices',m.indices],['Enums',m.enums],['Vistas',m.vistas],['Funciones',m.funciones],['Filas (aprox)',m.filas],['Migraciones',m.migraciones]];
$('#summaryCards').innerHTML = cards.map(([l,n])=>\`<div class="card"><div class="n">\${fmt(n)}</div><div class="l">\${l}</div></div>\`).join('')
 + \`<div class="card bad"><div class="n">\${m.backups}</div><div class="l">Backups a limpiar</div></div>\`
 + \`<div class="card warn"><div class="n">\${m.candidatasDesuso}</div><div class="l">Candidatas desuso</div></div>\`
 + \`<div class="card warn"><div class="n">\${m.findings3nf}</div><div class="l">Hallazgos 3FN</div></div>\`;

// Categorías
const maxCat = Math.max(...DATA.categorias.map(c=>c.tablas));
$('#catBars').innerHTML = DATA.categorias.map(c=>\`
  <div class="bar">
    <div class="lab">\${esc(c.cat)}</div>
    <div class="track"><div class="fill" style="width:\${(c.tablas/maxCat*100).toFixed(1)}%"></div></div>
    <div class="val">\${c.tablas} tablas · \${fmt(c.filas)} filas</div>
  </div>\`).join('');
$('#catBars').querySelectorAll('.bar').forEach((el,i)=>el.style.cursor='pointer',el=>{});
DATA.categorias.forEach((c,i)=>{ $('#catBars').children[i].onclick=()=>{ goTables(c.cat); }; $('#catBars').children[i].style.cursor='pointer'; });

// Filtro de categorías
const catSel=$('#catFilter');
catSel.innerHTML='<option value="">Todas las funciones</option>'+DATA.categorias.map(c=>\`<option value="\${esc(c.cat)}">\${esc(c.cat)} (\${c.tablas})</option>\`).join('');

function renderTables(){
  const q=$('#search').value.toLowerCase().trim();
  const cat=catSel.value;
  const rows=DATA.tables.filter(t=>{
    if(cat && t.cat!==cat) return false;
    if(!q) return true;
    if(t.name.toLowerCase().includes(q)) return true;
    return t.cols.some(c=>c.name.toLowerCase().includes(q));
  }).sort((a,b)=>a.name.localeCompare(b.name));
  $('#tableCount').textContent=rows.length+' tabla(s)';
  $('#tableBody').innerHTML=rows.map(t=>\`
    <tr class="tablerow" onclick="openTable('\${t.name}')">
      <td class="mono">\${esc(t.name)}</td>
      <td><span class="tag">\${esc(t.cat)}</span></td>
      <td>\${t.nCols}</td>
      <td>\${fmt(t.rows)}</td>
      <td class="muted">\${esc(t.size)}</td>
      <td>\${t.rls?'<span class="dot" style="background:var(--baja)"></span>sí':'<span class="dot" style="background:var(--alta)"></span>no'}</td>
    </tr>\`).join('');
}
$('#search').oninput=renderTables; catSel.onchange=renderTables;
function goTables(cat){ document.querySelector('nav button[data-s=tablas]').click(); catSel.value=cat; renderTables(); }

// Modal de tabla
function openTable(name){
  const t=DATA.tables.find(x=>x.name===name); if(!t)return;
  $('#mTitle').textContent=t.name;
  let h=\`<p class="muted" style="margin-top:0">\${esc(t.cat)} · \${t.nCols} columnas · \${fmt(t.rows)} filas · \${esc(t.size)} · RLS: \${t.rls?'sí':'no'}\${t.comment?' · '+esc(t.comment):''}</p>\`;
  h+='<table><thead><tr><th>Columna</th><th>Tipo</th><th>Atributos</th><th>Default</th></tr></thead><tbody>';
  h+=t.cols.map(c=>\`<tr>
    <td class="mono">\${esc(c.name)}\${c.pk?'<span class="badge pk">PK</span>':''}\${c.fk?'<span class="badge fk">FK</span>':''}\${c.uq&&!c.pk?'<span class="badge uq">UQ</span>':''}</td>
    <td class="mono" style="color:var(--brand)">\${esc(c.type)}</td>
    <td>\${c.nullable?'<span class="badge null">nullable</span>':'<span class="badge" style="background:rgba(63,185,80,.15);color:var(--baja)">NOT NULL</span>'}\${c.fk?' <span class="muted mono">→ '+esc(c.fk)+'</span>':''}</td>
    <td class="muted mono">\${esc(c.default||'')}</td>
  </tr>\`).join('')+'</tbody></table>';
  if(t.fks.length){ h+='<details open><summary>Foreign keys ('+t.fks.length+')</summary><div class="mono" style="font-size:12px;margin-top:6px">'+t.fks.map(f=>esc(f.col)+' → '+esc(f.ref)).join('<br>')+'</div></details>'; }
  if(t.indexes.length){ h+='<details><summary>Índices ('+t.indexes.length+')</summary><div class="mono" style="font-size:11px;margin-top:6px;color:var(--muted)">'+t.indexes.map(esc).join('<br>')+'</div></details>'; }
  if(t.checks.length){ h+='<details><summary>Checks ('+t.checks.length+')</summary><div class="mono" style="font-size:11px;margin-top:6px;color:var(--muted)">'+t.checks.map(esc).join('<br>')+'</div></details>'; }
  $('#mBody').innerHTML=h; $('#overlay').classList.add('open');
}
function closeModal(){ $('#overlay').classList.remove('open'); }
$('#overlay').onclick=e=>{ if(e.target.id==='overlay') closeModal(); };
document.onkeydown=e=>{ if(e.key==='Escape') closeModal(); };

// Desuso
const d=DATA.dead;
let dh='';
dh+=\`<div class="notebox">\${esc(d.resumen?.notaMetodo||'')}</div>\`;
dh+='<h3>🗑️ Tablas de backup ('+(d.backupTables||[]).length+') — basura segura para dropear</h3>';
dh+='<table><thead><tr><th>Tabla</th><th>Filas</th></tr></thead><tbody>'+(d.backupTables||[]).map(b=>\`<tr><td class="mono">\${esc(b.name)}</td><td>\${fmt(b.rows||0)}</td></tr>\`).join('')+'</tbody></table>';
dh+='<h3 style="margin-top:24px">⚠️ Candidatas a desuso ('+(d.unusedTables||[]).length+') — revisar antes de tocar</h3>';
dh+='<table><thead><tr><th>Tabla</th><th>Filas</th><th>Motivo</th></tr></thead><tbody>'+(d.unusedTables||[]).map(u=>\`<tr><td class="mono">\${esc(u.name)}</td><td>\${fmt(u.rows||0)}</td><td class="muted">\${esc(u.reason)}</td></tr>\`).join('')+'</tbody></table>';
if((d.scraperTables||[]).length){ dh+='<h3 style="margin-top:24px">🔧 Tablas de scraper (staging EPP)</h3><table><thead><tr><th>Tabla</th><th>Filas</th><th>¿Usada en la app?</th></tr></thead><tbody>'+d.scraperTables.map(s=>\`<tr><td class="mono">\${esc(s.name)}</td><td>\${fmt(s.rows||0)}</td><td>\${s.usadaEnApp?'sí':'<span style="color:var(--media)">no — staging</span>'}</td></tr>\`).join('')+'</tbody></table>'; }
dh+='<h3 style="margin-top:24px">📅 Particionado por fecha (NO es desuso — particiones declarativas nativas)</h3>';
dh+=(d.partitioning||[]).map(p=>\`<div class="finding"><h4>\${esc(p.group)}</h4><div class="det">\${esc(p.note)}</div><div class="aff">Particiones: \${(p.tables||[]).map(esc).join(', ')}</div>\${(p.vacias||[]).length?'<div class="muted mono" style="font-size:11px;margin-top:4px">Vacías: '+p.vacias.map(esc).join(', ')+'</div>':''}</div>\`).join('');
if((d.unusedColumns||[]).length){ dh+='<h3 style="margin-top:24px">Columnas sospechosas</h3><table><thead><tr><th>Tabla</th><th>Columna</th><th>Motivo</th></tr></thead><tbody>'+d.unusedColumns.map(c=>\`<tr><td class="mono">\${esc(c.table)}</td><td class="mono">\${esc(c.column)}</td><td class="muted">\${esc(c.reason)}</td></tr>\`).join('')+'</tbody></table>'; }
else { dh+='<div class="notebox" style="margin-top:24px">✅ <strong>0 columnas muertas detectadas.</strong> Las migraciones ya limpiaron los leftovers históricos (columnas <code>*_old</code>, textos reemplazados por FK, etc.) con <code>DROP COLUMN</code>.</div>'; }
if((d.migrationChurn||[]).length){ dh+='<details style="margin-top:16px"><summary>Notas de migraciones viejas / renombres</summary>'+d.migrationChurn.map(c=>'<div class="det">• '+esc(c.detalle||c)+'</div>').join('')+'</details>'; }
$('#deadContent').innerHTML=dh;

// 3FN
const r=DATA.tnf.resumen||{};
$('#nfCards').innerHTML=[['Sin PK',r.sinPK,'bad'],['FKs sin índice',r.fksSinIndice,'bad'],['Redundancia 3FN',r.redundancia3fn,'warn'],['jsonb "bolsa"',r.jsonbBolsa,'warn'],['Tablas anchas',r.tablasAnchas,'warn'],['Hallazgos alta',r.porSeveridad?.alta,'bad']]
  .map(([l,n,k])=>\`<div class="card \${k}"><div class="n">\${n??'—'}</div><div class="l">\${l}</div></div>\`).join('');
$('#findings').innerHTML=(DATA.tnf.findings||[]).map(f=>\`
  <div class="finding \${f.severidad}">
    <h4><span class="sev \${f.severidad}">\${f.severidad.toUpperCase()}</span> <span class="tag">\${esc(f.categoria)}</span> \${esc(f.titulo)}</h4>
    <div class="det">\${esc(f.detalle)}</div>
    \${(f.afectados||[]).length?'<div class="aff">'+f.afectados.map(esc).join(' · ')+'</div>':''}
    <div class="rec">💡 <strong>Recomendación:</strong> \${esc(f.recomendacion)}</div>
  </div>\`).join('');

renderTables();
</script>
</body>
</html>`

writeFileSync(`${DIR}/auditoria-base-datos.html`, html)
console.log('OK → _auditoria-db/auditoria-base-datos.html')
console.log('Tablas:', meta.tablas, '| Categorías:', categorias.length, '| Findings 3NF:', meta.findings3nf, '| Backups:', meta.backups)
console.log('Categorías:', categorias.map(c => `${c.cat}=${c.tablas}`).join(', '))
