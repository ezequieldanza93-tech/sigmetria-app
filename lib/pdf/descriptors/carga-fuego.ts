/**
 * descriptors/carga-fuego.ts — Descriptor del INFORME DE CÁLCULO DE CARGA DE FUEGO
 * (Dec. 351/79, Anexo VII).
 *
 * A DIFERENCIA del resto de los protocolos (ruido / iluminación / PAT / carga térmica),
 * la Carga de Fuego NO tiene un formulario legal obligatorio: es una MEMORIA DE CÁLCULO.
 * Por eso el HTML del CUERPO lo diseñamos NOSOTROS (no se embebe un HTML externo de
 * protocolos-html.ts) y va INLINE como template string en este descriptor.
 *
 * El cuerpo es DATA-DRIVEN: genera N sectores (cada uno con su tabla de materiales +
 * tarjetas de resultado Qf / Riesgo / F-exigido / extintores A·B + chip Cumple), no es
 * "llenar campos vacíos".
 *
 * Estética: "Opción B — Impronta Sigmetría" (aprobada por el usuario en
 * _preview/carga-fuego-estilos.html): moderno, verde Sigmetría, tarjetas de resultado.
 *
 * CONTRATO con el motor (protocolo-engine.ts → ensamblarProtocolo):
 *   - el motor extrae <style> y <body> de `html`, llama `inyectarBody(body, datos)`,
 *     y DESPUÉS estampa watermark + banda de logos en cada `<section class="hoja vert">`
 *     y la firma del profesional sobre `<div class="ac">${firmaTexto}</div>`.
 *   - por eso CADA sector va en su propia `<section class="hoja vert">` (recibe watermark +
 *     logos), y la ÚLTIMA sección incluye el bloque de firma con el `<div class="ac">`.
 *   - el CSS de carátula / anexos / watermark / logos / firma lo aporta el motor
 *     (SHARED_CSS): acá solo definimos el page-chrome (@page / .hoja / .vert) y el
 *     CSS del cuerpo CF (estilo Opción B), evitando colisiones con SHARED_CSS.
 *
 * NO toca archivos compartidos. El reporte (reporte-protocolo-carga-fuego.ts) mapea los
 * datos reales y llama renderProtocolo(CARGA_FUEGO_DESCRIPTOR, datos).
 */

import {
  D,
  type DatosProtocoloBase,
  type ProtocoloDescriptor,
} from '@/lib/pdf/protocolo-engine'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de la tabla de materiales de un sector. Valores ya formateados a texto. */
export interface MaterialCargaFuego {
  /** Descripción del material (ej. "Madera", "Papel / cartón"). */
  descripcion: string
  /** Estado físico (ej. "Sólido", "Líquido"). */
  estado: string
  /** Peso en kg (formateado, ej. "1.200 kg"). */
  peso: string
  /** Poder calorífico inferior PCI (formateado, ej. "4.400"). */
  pci: string
  /** Coeficiente C respecto a la madera (formateado, ej. "1,00"). */
  coefC: string
  /** Equivalente en madera (formateado, ej. "1.200 kg"). */
  equivMadera: string
  /** Calor generado en Kcal = peso · PCI (formateado, ej. "5.280.000"). */
  calorGenerado: string
}

/** Un sector de incendio con su inventario de materiales y resultados del cálculo. */
export interface SectorCargaFuego {
  /** Nombre del sector (ej. "Depósito de materiales"). */
  nombre: string
  /** Superficie del sector (formateada, ej. "450 m²"). */
  superficie: string
  /** Filas de materiales del sector. */
  materiales: MaterialCargaFuego[]
  /** Equivalente en madera total Σ (formateado, ej. "2.609 kg"). */
  equivTotal: string
  /** Calor generado total Σ en Kcal (formateado, ej. "11.480.000"). */
  calorTotal: string
  /** Clase de fuego predominante del sector ("A" | "B" | "A·B"). */
  claseFuego: string
  /** Carga de fuego Qf en kg/m² (formateada, ej. "5,80"). */
  qf: string
  /** Riesgo (ej. "R3 · Combustibles"). */
  riesgo: string
  /** Resistencia al fuego exigida (ej. "F 60"). */
  fExigido: string
  /** Potencial extintor clase A (ej. "3A" o "—"). */
  potencialA: string
  /** Potencial extintor clase B (ej. "—" o "20B"). */
  potencialB: string
  /** Estado del sector (true → "Verificar" [cálculo completo, falta contrastar el
   *  equipamiento real]; false → "No cumple"; null → "Sin dato"). NO afirma "Cumple". */
  cumple: boolean | null
}

/** Una fila de la tabla de dimensionamiento de extintores (Resultados del estudio). */
export interface FilaExtintor {
  /** Nombre del sector. */
  sector: string
  /** Superficie del sector (formateada, ej. "450 m²"). */
  superficie: string
  /** Potencial extintor mínimo exigido clase A (Tablas I/II), ej. "3A", o '—'.
   *  OJO: es el potencial extintor, NO la carga de fuego en kg/m². */
  cargaA: string
  /** Potencial extintor mínimo exigido clase B (Tablas I/II), ej. "20B", o '—'. */
  cargaB: string
  /** Tipo de extintor necesario. */
  tipo: string
  /** Cantidad mínima de matafuegos (Art. 176). */
  cantidad: string
  /** Estado de cumplimiento ("Cumple" | "Verificar" | "Sin dato"). */
  cumple: string
  /** Recomendaciones / notas del sector. */
  recomendaciones: string
}

/** Una fila de la tabla de condiciones de situación / construcción / extinción. */
export interface FilaCondiciones {
  /** Nombre del sector. */
  sector: string
  /** Condición de situación (texto o '—' si no se capturó). */
  situacion: string
  /** Condición de construcción (texto o '—'). */
  construccion: string
  /** Condición de extinción (texto o '—'). */
  extincion: string
  /** Resistencia al fuego exigida del sector (ej. "F 60" o '—'). */
  resistencia: string
}

/** Bloque estructurado de conclusiones, derivado del cálculo + texto libre del modal. */
export interface ConclusionesCargaFuego {
  /** Cantidad de extintores conforme la carga de fuego: "Cumple" | "Verificar" | "Sin dato". */
  extintores: string
  /** Condiciones de situación: "Cumple" | "No cumple" | "No se relevó". */
  situacion: string
  /** Condiciones de construcción: "Cumple" | "No cumple" | "No se relevó". */
  construccion: string
  /** Condiciones de extinción: "Cumple" | "No cumple" | "No se relevó". */
  extincion: string
  /** Texto libre de conclusiones capturado en el modal (opcional). */
  textoConclusiones?: string
  /** Texto libre de recomendaciones capturado en el modal (opcional). */
  textoRecomendaciones?: string
}

/** Datos del Informe de Carga de Fuego: base compartida + sectores data-driven. */
export interface DatosProtocoloCargaFuego extends DatosProtocoloBase {
  /** Sectores de incendio relevados. Al menos uno (el legacy se trata como 1 sector). */
  sectores: SectorCargaFuego[]
  /** Descripción de la actividad del establecimiento (texto libre, opcional). */
  actividad?: string
  /** Superficie cubierta total del establecimiento (formateada, opcional). */
  superficieCubierta?: string
  /** Clasificación de riesgo del establecimiento (ej. "R3 · Muy combustibles"). */
  clasificacionRiesgo?: string
  /** Tabla de dimensionamiento de extintores (auto-calculada al emitir). */
  extintores: FilaExtintor[]
  /** Tabla de condiciones de situación/construcción/extinción por sector. */
  condiciones: FilaCondiciones[]
  /** Bloque estructurado de conclusiones. */
  conclusiones: ConclusionesCargaFuego
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXTOS / CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/** Texto EXACTO del `<div class="ac">…</div>`: el motor lo busca para insertar el firmante. */
const FIRMA_TEXTO = 'Firma, aclaración y registro del Profesional interviniente.'

/** Marcador que inyectarBody reemplaza por las secciones de sectores. */
const MARCADOR = '<!--CF_CONTENIDO-->'

// ─────────────────────────────────────────────────────────────────────────────
// CSS DEL CUERPO (Opción B — Impronta Sigmetría) + page-chrome
// ─────────────────────────────────────────────────────────────────────────────
//
// OJO: NO redefinimos selectores que ya aporta SHARED_CSS (.dato, .lg, .proto-logos,
// .firma, .card, .wm, etc.). Acá va el page-chrome (@page/.hoja/.vert, igual que el
// resto de los protocolos) y todo el CSS del cuerpo CF prefijado con `.cf` para no
// colisionar con la carátula/anexos del motor.
const CF_STYLE = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #6b6b6b; }
  @page p-vert { size: A4 portrait; margin: 12mm; }
  .hoja { background: #fff; margin: 14px auto; padding: 12mm; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
  .vert { width: 210mm; min-height: 297mm; page: p-vert; }
  @media print {
    html, body { background: #fff; }
    .hoja { margin: 0; box-shadow: none; page-break-after: always; }
    .hoja:last-child { page-break-after: auto; }
    .vert { width: auto; min-height: auto; padding: 12mm; }
    .cf-secbar h4, .cf thead th, .cf .total td, .cf .result, .cf .chip,
    .cf .secbar .dot, .cf .result .v.amber { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* ── Cuerpo CF (estilo Opción B) ─────────────────────────────────────────── */
  .cf { font-family: 'Montserrat','Poppins','Segoe UI',sans-serif; color:#1c2420; }
  .cf .kick { font-size:10pt; letter-spacing:2px; text-transform:uppercase; color:#7b8a7b; }
  .cf h3.t { font-size:18pt; margin:2px 0 4px; color:#16271a; font-weight:800; }
  .cf .lead { font-family:'Poppins',sans-serif; font-size:9pt; line-height:1.5; color:#3a4a3a; margin:0 0 6mm; }

  .cf .secbar { display:flex; align-items:center; gap:8px; margin:6mm 0 3mm; }
  .cf .secbar .dot { width:9px; height:9px; border-radius:50%; background:#2E7D33; }
  .cf .secbar h4 { margin:0; font-size:13pt; color:#1f5723; font-weight:700; letter-spacing:.2px; }
  .cf .secbar .meta { margin-left:auto; font-size:9.5pt; color:#7b8a7b; }

  .cf table { width:100%; border-collapse:collapse; font-size:10pt; }
  .cf thead th { text-align:left; font-size:8pt; letter-spacing:.4px; text-transform:uppercase; color:#7b8a7b; font-weight:700; padding:6px 8px; border-bottom:2px solid #2E7D33; }
  .cf tbody td { padding:7px 8px; border-bottom:1px solid #E4E8E4; }
  .cf tbody tr:nth-child(even) td { background:#f6f9f6; }
  .cf .num { text-align:right; font-variant-numeric:tabular-nums; font-family:'Poppins',sans-serif; }
  .cf .total td { font-weight:700; border-top:2px solid #2E7D33; border-bottom:none; color:#16271a; background:#fff; }

  .cf .result { margin-top:4mm; display:grid; grid-template-columns:1fr 1fr 1fr; border:1px solid #E4E8E4; border-radius:10px; overflow:hidden; }
  .cf .result.mt { margin-top:3mm; }
  .cf .result .cell { padding:11px 14px; border-right:1px solid #E4E8E4; }
  .cf .result .cell:last-child { border-right:none; }
  .cf .result .cell.hl { background:#f0f7f0; }
  .cf .result .k { font-size:8pt; letter-spacing:.5px; text-transform:uppercase; color:#7b8a7b; font-family:'Poppins',sans-serif; }
  .cf .result .v { font-size:18pt; font-weight:800; color:#1f5723; margin-top:2px; font-family:'Poppins',sans-serif; }
  .cf .result .v.sm { font-size:13pt; }
  .cf .result .v.md { font-size:15pt; }
  .cf .result .v.amber { color:#9A7B00; }
  .cf .result .v .u { font-size:10pt; font-weight:600; }
  .cf .chip { display:inline-block; font-size:9.5pt; font-weight:700; padding:3px 11px; border-radius:100px; background:#eaf3ea; color:#1f5723; margin-top:5px; }
  .cf .chip.no { background:#fdeaea; color:#a32020; }
  .cf .chip.na { background:#eef1ee; color:#7b8a7b; }

  /* Bloque de firma del cuerpo (el motor inyecta el firmante en .ac vía SHARED_CSS) */
  .cf .firmline { text-align:center; margin-top:10mm; font-size:10pt; color:#444; font-family:'Poppins',sans-serif; }
  .cf .firmline .linea { letter-spacing:1px; color:#999; }

  /* ── Secciones normativas / texto fijo ───────────────────────────────────── */
  .cf h2 { font-size:13pt; color:#1f5723; font-weight:700; border-left:4px solid #2E7D33; padding-left:10px; margin:7mm 0 3mm; }
  .cf p.tx { font-family:'Poppins',sans-serif; font-size:9.5pt; line-height:1.55; color:#3a4a3a; margin:5px 0; text-align:justify; }
  .cf p.tx b { color:#16271a; }
  .cf ul.tx { margin:5px 0 5px 18px; font-family:'Poppins',sans-serif; font-size:9.5pt; line-height:1.5; color:#3a4a3a; }
  .cf ul.tx li { margin:2px 0; }
  .cf .nota { font-size:8pt; color:#7b8a7b; font-family:'Poppins',sans-serif; line-height:1.45; margin:3mm 0 0; }

  /* Tabla simple (sectores+superficie / condiciones / dimensionamiento) */
  .cf table.grid th { text-align:left; font-size:7.5pt; letter-spacing:.3px; text-transform:uppercase; color:#7b8a7b; font-weight:700; padding:6px 8px; border-bottom:2px solid #2E7D33; }
  .cf table.grid td { padding:6px 8px; border-bottom:1px solid #E4E8E4; font-size:9pt; vertical-align:top; }
  .cf table.grid tbody tr:nth-child(even) td { background:#f6f9f6; }
  .cf table.grid td.c { text-align:center; }
  .cf .badge { display:inline-block; font-size:8.5pt; font-weight:700; padding:2px 9px; border-radius:100px; }
  .cf .badge.ok { background:#eaf3ea; color:#1f5723; }
  .cf .badge.warn { background:#fff6e0; color:#9A7B00; }
  .cf .badge.na { background:#eef1ee; color:#7b8a7b; }

  /* Bloque de conclusiones */
  .cf .concl { border:1px solid #E4E8E4; border-radius:10px; overflow:hidden; margin-top:3mm; }
  .cf .concl .row { display:flex; justify-content:space-between; align-items:center; padding:9px 14px; border-bottom:1px solid #E4E8E4; font-family:'Poppins',sans-serif; font-size:10pt; }
  .cf .concl .row:last-child { border-bottom:none; }
  .cf .concl .row .lbl { color:#3a4a3a; }
  .cf .concl-free { margin-top:4mm; }
  .cf .concl-free h3 { font-size:10pt; color:#1f5723; margin:4mm 0 2px; }
  .cf .concl-free p { font-family:'Poppins',sans-serif; font-size:9.5pt; line-height:1.5; color:#3a4a3a; margin:2px 0; text-align:justify; white-space:pre-wrap; }

  /* Marco para imágenes/planos ausentes */
  .cf .frame { border:1px dashed #c9d3c9; border-radius:8px; min-height:34mm; display:flex; align-items:center; justify-content:center; color:#9aa6a0; font-style:italic; font-size:9pt; margin:3mm 0; font-family:'Poppins',sans-serif; }
`

// ─────────────────────────────────────────────────────────────────────────────
// HTML BASE (style + body con marcador). El motor extrae <style> y <body>.
// ─────────────────────────────────────────────────────────────────────────────

const CARGA_FUEGO_HTML = `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">
<style>${CF_STYLE}</style></head>
<body>${MARCADOR}</body></html>`

// ─────────────────────────────────────────────────────────────────────────────
// GENERACIÓN DATA-DRIVEN DEL CUERPO
// ─────────────────────────────────────────────────────────────────────────────

/** Fila de material → <tr>. Valores envueltos en D() (tipografía de datos de la app). */
function filaMaterial(m: MaterialCargaFuego): string {
  return (
    `<tr>` +
    `<td>${D(m.descripcion)}</td>` +
    `<td>${D(m.estado)}</td>` +
    `<td class="num">${D(m.peso)}</td>` +
    `<td class="num">${D(m.pci)}</td>` +
    `<td class="num">${D(m.calorGenerado)}</td>` +
    `<td class="num">${D(m.coefC)}</td>` +
    `<td class="num">${D(m.equivMadera)}</td>` +
    `</tr>`
  )
}

/** Chip de estado del sector. El cumplimiento real (equipamiento instalado vs.
 *  potencial extintor exigido) NO se persiste, así que un sector con el cálculo
 *  completo (riesgo + F definidos) muestra "Verificar" — NUNCA afirma "Cumple" sin
 *  respaldo, en línea con la tabla de dimensionamiento. */
function chipCumple(cumple: boolean | null): string {
  if (cumple === true) return `<span class="chip na">Verificar</span>`
  if (cumple === false) return `<span class="chip no">No cumple</span>`
  return `<span class="chip na">Sin dato</span>`
}

/**
 * Sección de UN sector (cálculo de carga de fuego) → `<section class="hoja vert">`.
 * El motor le estampa watermark + logos al inicio (split sobre el tag de apertura).
 * La firma y las conclusiones ya NO van acá: viven en su propia sección final.
 *
 * @param s     sector a renderizar
 * @param idx   índice (1..N) para el numerador de hoja
 * @param total total de sectores
 */
function seccionSector(s: SectorCargaFuego, idx: number, total: number): string {
  const filas = s.materiales.length > 0
    ? s.materiales.map(filaMaterial).join('')
    : `<tr><td colspan="7" style="text-align:center;color:#7b8a7b;padding:12px;">Sin materiales relevados en este sector.</td></tr>`

  return `<section class="hoja vert"><div class="cf">
  <h2>Cálculo de carga de fuego por sector</h2>
  <div class="secbar"><span class="dot"></span><h4>${D(s.nombre)}</h4><span class="meta">Superficie&nbsp;·&nbsp;${D(s.superficie)}&nbsp;·&nbsp;Clase&nbsp;${D(s.claseFuego)}</span></div>
  <table>
    <thead>
      <tr><th>Material</th><th>Estado</th><th class="num">Cantidad</th><th class="num">P. Calorífico</th><th class="num">Calor generado</th><th class="num">Coef. C</th><th class="num">Equiv. madera</th></tr>
    </thead>
    <tbody>
      ${filas}
      <tr class="total"><td colspan="4">Total calor generado (Σ)</td><td class="num">${D(s.calorTotal)}</td><td></td><td class="num">${D(s.equivTotal)}</td></tr>
    </tbody>
  </table>
  <div class="result">
    <div class="cell hl"><div class="k">Carga de fuego (Qf)</div><div class="v">${D(s.qf)} <span class="u">kg/m²</span></div></div>
    <div class="cell"><div class="k">Riesgo</div><div class="v sm">${D(s.riesgo)}</div></div>
    <div class="cell"><div class="k">Resist. al fuego exigida</div><div class="v amber sm">${D(s.fExigido)}</div></div>
  </div>
  <div class="result mt">
    <div class="cell"><div class="k">Potencial extintor A</div><div class="v md">${D(s.potencialA)}</div></div>
    <div class="cell"><div class="k">Potencial extintor B</div><div class="v md">${D(s.potencialB)}</div></div>
    <div class="cell hl"><div class="k">Estado</div><div>${chipCumple(s.cumple)}</div></div>
  </div>
  <div class="hoja-num">Sector ${idx} de ${total}</div>
</div></section>`
}

/** Escapa HTML básico para insertar texto libre del usuario sin romper el markup. */
function esc(raw: string | null | undefined): string {
  if (raw == null) return ''
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Sección INTRO (texto normativo fijo + ubicación data-driven + tabla de sectores).
 * Es la primera hoja del cuerpo: Objetivo, Introducción, Legislación, Ubicación y el
 * cuadro de sectores/superficies. Texto FIJO salvo la ubicación.
 */
function seccionIntro(d: DatosProtocoloCargaFuego): string {
  const ubicacion = [d.direccion, d.localidad, d.provincia ? `Pcia. de ${d.provincia}` : null]
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => D(x))
    .join(', ')

  const filasSectores = d.sectores.length > 0
    ? d.sectores.map((s) => `<tr><td>${D(s.nombre)}</td><td class="c">${D(s.superficie)}</td></tr>`).join('')
    : `<tr><td colspan="2" style="text-align:center;color:#7b8a7b;">Sin sectores relevados.</td></tr>`

  return `<section class="hoja vert"><div class="cf">
  <div class="kick">Informe técnico · Dec. 351/79 (Anexo VII)</div>
  <h3 class="t">Evaluación de dotación de extintores mediante el cálculo de carga de fuego</h3>
  <p class="lead">${D(d.razonSocial)}${d.establecimiento ? ' — ' + D(d.establecimiento) : ''}</p>

  <h2>Objetivo y organización del informe</h2>
  <p class="tx">El presente informe tiene como objetivo determinar la cantidad y el tipo de extintores necesarios para una correcta protección contra incendios en el sitio de referencia, a través del cálculo de la carga de fuego, de acuerdo con las normativas y leyes descriptas.</p>

  <h2>Introducción</h2>
  <p class="tx">La carga de fuego se define como el peso en madera por unidad de superficie (Kg/m²) capaz de desarrollar una cantidad de calorías equivalente a la de los materiales contenidos en el sector de incendio.</p>
  <p class="tx"><b>Sector de incendio:</b> espacio físico que es sometido al estudio de la carga de fuego.</p>
  <p class="tx">Como patrón de referencia se considera la madera, con un poder calorífico inferior de 4.400 Kcal/kg, a modo de combustible estándar.</p>
  <p class="tx">En el cálculo de la carga de fuego se incluyen todos los materiales combustibles presentes en el sector considerado, aun los incorporados al edificio mismo (pisos, revestimientos, puertas, cielorrasos, etc.).</p>
  <p class="tx">Los combustibles líquidos o gaseosos contenidos en tuberías, recipientes o depósitos se suponen uniformemente repartidos sobre la superficie del sector de incendio.</p>
  <p class="tx">Si la repartición de los materiales combustibles dentro del local está realizada permanentemente de manera desigual, se toma como base la carga de fuego más elevada en una superficie parcial de 200 m².</p>
  <p class="tx">Las explosiones solo se considerarán como posibles fuentes de ignición.</p>

  <h2>Legislación y normativas utilizadas</h2>
  <p class="tx">Para la evaluación de los elementos contra incendios se han utilizado las siguientes leyes, decretos y normas técnicas:</p>
  <ul class="tx">
    <li>Ley Nacional 19.587 — Decreto Reglamentario 351/79 — Seguridad e Higiene en el Trabajo.</li>
    <li>Norma IRAM 3523 — Extintores a base de polvo bajo presión, manuales.</li>
    <li>Norma IRAM 3550 — Extintores a base de polvo bajo presión, sobre ruedas.</li>
    <li>Norma IRAM 3509 — Extintores a base de CO₂, manuales.</li>
    <li>Norma IRAM 3565 — Extintores a base de CO₂, sobre ruedas.</li>
    <li>Norma IRAM 3525 — Extintores a base de agua bajo presión, manuales.</li>
    <li>Norma IRAM 3542 — Ensayo de potencial extintor clase A.</li>
    <li>Norma IRAM 3543 — Ensayo de potencial extintor clase B.</li>
  </ul>

  <h2>Ubicación del predio y descripción</h2>
  <p class="tx">La planta de ${D(d.razonSocial)} se ubica en ${ubicacion || D(null)}.</p>
  <p class="tx">Dentro de sus actividades se realizan ${D(d.actividad)}, en una superficie cubierta de ${D(d.superficieCubierta)}.</p>

  <h2>Desarrollo — Sectores y superficies</h2>
  <table class="grid">
    <thead><tr><th>Sector</th><th class="c">Superficie (m²)</th></tr></thead>
    <tbody>${filasSectores}</tbody>
  </table>
  <div class="hoja-num">Introducción</div>
</div></section>`
}

/** Badge de cumplimiento de la tabla de dimensionamiento. */
function badgeCumple(estado: string): string {
  const low = estado.trim().toLowerCase()
  if (low === 'cumple') return `<span class="badge ok">Cumple</span>`
  if (low === 'verificar') return `<span class="badge warn">Verificar</span>`
  if (low === 'excede') return `<span class="badge ok">Excede</span>`
  return `<span class="badge na">Sin dato</span>`
}

/**
 * Sección RESULTADOS: tabla de dimensionamiento de extintores + clasificación de riesgo
 * + tabla de condiciones de situación/construcción/extinción. La tabla `res` y la `kv`
 * del HTML de referencia se construyen acá (no estaban en ningún HTML embebido).
 */
function seccionResultados(d: DatosProtocoloCargaFuego): string {
  const filasExt = d.extintores.length > 0
    ? d.extintores.map((e) =>
        `<tr>` +
        `<td>${D(e.sector)}</td>` +
        `<td class="c">${D(e.superficie)}</td>` +
        `<td class="c">${D(e.cargaA)}</td>` +
        `<td class="c">${D(e.cargaB)}</td>` +
        `<td>${D(e.tipo)}</td>` +
        `<td class="c">${D(e.cantidad)}</td>` +
        `<td class="c">${badgeCumple(e.cumple)}</td>` +
        `<td style="font-size:8pt">${esc(e.recomendaciones) || '—'}</td>` +
        `</tr>`,
      ).join('')
    : `<tr><td colspan="8" style="text-align:center;color:#7b8a7b;">Sin sectores para dimensionar.</td></tr>`

  // Situación / construcción / extinción son TEXTO LIBRE del profesional: se escapan
  // (esc) para no romper el markup. Si vienen vacías llegan como '—' desde el reporte;
  // preservamos ese guion (esc('—') === '—'). El sector y la resistencia son valores
  // derivados/controlados → D() (estilo .dato + fallback a guion).
  const filasCond = d.condiciones.length > 0
    ? d.condiciones.map((c) =>
        `<tr>` +
        `<td>${D(c.sector)}</td>` +
        `<td>${esc(c.situacion) || '—'}</td>` +
        `<td>${esc(c.construccion) || '—'}</td>` +
        `<td>${esc(c.extincion) || '—'}</td>` +
        `<td class="c">${D(c.resistencia)}</td>` +
        `</tr>`,
      ).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#7b8a7b;">Sin sectores relevados.</td></tr>`

  return `<section class="hoja vert"><div class="cf">
  <h2>Resultados del estudio — Dimensionamiento de extintores</h2>
  <p class="tx">A partir de la carga de fuego de cada sector, su nivel de riesgo y su superficie se determina el potencial extintor mínimo (Tablas I y II) y la dotación mínima de matafuegos (Art. 176). El dimensionamiento es auto-calculado y expresa el <b>mínimo normativo exigible</b>; debe contrastarse con el equipamiento real del establecimiento.</p>
  <table class="grid">
    <thead><tr><th>Sector</th><th class="c">Sup. (m²)</th><th class="c">Potencial A *</th><th class="c">Potencial B *</th><th>Tipo de extintor **</th><th class="c">Cant. ***</th><th class="c">Estado</th><th>Recomendaciones</th></tr></thead>
    <tbody>${filasExt}</tbody>
  </table>
  <p class="nota">NOTA: en los extintores de polvo, el potencial extintor mencionado se logra con Polvo Químico Seco ABC color VERDE (IRAM 3569).<br>
  * Potencial extintor mínimo exigido según Decreto 351/79, Cap. 18, Anexo VII, Tablas I y II (NO es la carga de fuego en kg/m²).<br>
  ** Tipo de extintor recomendado (Polvo Químico Seco ABC, IRAM 3569).<br>
  *** Cantidad mínima según Decreto 351/79, Cap. 18, Art. 176 (un matafuego cada 200 m² de superficie a proteger).</p>

  <h2>Condiciones de situación, construcción y extinción</h2>
  <p class="tx">Clasificación de riesgo del establecimiento: ${D(d.clasificacionRiesgo)}.</p>
  <table class="grid">
    <thead><tr><th>Sector</th><th>Situación</th><th>Construcción</th><th>Extinción</th><th class="c">Resist. al fuego</th></tr></thead>
    <tbody>${filasCond}</tbody>
  </table>
  <p class="nota">Las condiciones de situación, construcción y extinción exigidas (Dec. 351/79) deben evaluarse caso por caso (Aplica / No aplica) según las características constructivas y de uso del establecimiento. Los campos sin relevamiento se muestran con guion.</p>
  <div class="hoja-num">Resultados</div>
</div></section>`
}

/** Una fila del bloque de conclusiones estructurado. */
function filaConcl(label: string, estado: string): string {
  const low = estado.trim().toLowerCase()
  let badge: string
  if (low === 'cumple') badge = `<span class="badge ok">Cumple</span>`
  else if (low === 'no cumple') badge = `<span class="badge na" style="background:#fdeaea;color:#a32020">No cumple</span>`
  else if (low === 'verificar') badge = `<span class="badge warn">Verificar</span>`
  else badge = `<span class="badge na">${esc(estado) || 'No se relevó'}</span>`
  return `<div class="row"><span class="lbl">${esc(label)}</span>${badge}</div>`
}

/**
 * Sección CONCLUSIONES (última hoja): bloque estructurado derivado del cálculo +
 * el texto libre de conclusiones/recomendaciones del modal. Incluye la FIRMA (el
 * motor inyecta el firmante en `.ac`).
 */
function seccionConclusiones(d: DatosProtocoloCargaFuego): string {
  const c = d.conclusiones
  const libre = [
    c.textoConclusiones && c.textoConclusiones.trim()
      ? `<h3>Conclusiones</h3><p>${esc(c.textoConclusiones.trim())}</p>` : '',
    c.textoRecomendaciones && c.textoRecomendaciones.trim()
      ? `<h3>Recomendaciones</h3><p>${esc(c.textoRecomendaciones.trim())}</p>` : '',
  ].join('')

  return `<section class="hoja vert"><div class="cf">
  <h2>Conclusiones</h2>
  <div class="concl">
    ${filaConcl('Cantidad de extintores de acuerdo a la carga de fuego', c.extintores)}
    ${filaConcl('Condiciones de situación', c.situacion)}
    ${filaConcl('Condiciones de construcción', c.construccion)}
    ${filaConcl('Condiciones de extinción', c.extincion)}
  </div>
  ${libre ? `<div class="concl-free">${libre}</div>` : ''}
  <div class="firmline"><div class="linea">………………………………………………</div><div class="ac">${FIRMA_TEXTO}</div></div>
  <div class="hoja-num">Conclusiones</div>
</div></section>`
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCRIPTOR
// ─────────────────────────────────────────────────────────────────────────────

export const CARGA_FUEGO_DESCRIPTOR: ProtocoloDescriptor<DatosProtocoloCargaFuego> = {
  html: CARGA_FUEGO_HTML,
  titulo: 'Cálculo de Carga de Fuego',
  norma: 'Dec. 351/79 (Anexo VII)',
  descripcion:
    'Memoria de cálculo de la carga de fuego ponderada del establecimiento, expresada en kilogramos equivalentes de madera por metro cuadrado (Qf), conforme al método del Dec. 351/79 (Anexo VII). Para cada sector de incendio se releva el inventario de materiales combustibles, se determina su equivalente en madera (peso · coeficiente C) y, a partir de la carga de fuego resultante, se establece el nivel de riesgo, la resistencia al fuego exigida y el potencial extintor mínimo requerido.',
  // Carga de fuego NO usa instrumento de medición: es un cálculo por inventario.
  equipoTexto: () =>
    'Cálculo según el método de carga de fuego ponderada (equivalente en madera) del Dec. 351/79 (Anexo VII). Los materiales combustibles fueron relevados en sitio; el poder calorífico (PCI) y el coeficiente C de cada material surgen de la tabla del Anexo VII. No interviene instrumento de medición.',
  firmaTexto: FIRMA_TEXTO,
  inyectarBody(body, d) {
    const sectores = d.sectores ?? []
    const total = sectores.length

    // Caso sin sectores: intro (con la ubicación y textos normativos) + una sección de
    // conclusiones con la firma, para que el informe nunca quede sin cuerpo ni firmante.
    if (total === 0) {
      const vacio = seccionIntro(d) + seccionConclusiones(d)
      return body.split(MARCADOR).join(vacio)
    }

    // Estructura del cuerpo:
    //  1) Intro (objetivo / introducción / legislación / ubicación / sectores)
    //  2) Una hoja por sector (cálculo de carga de fuego)
    //  3) Resultados (dimensionamiento de extintores + condiciones + clasificación)
    //  4) Conclusiones (bloque estructurado + texto libre + firma)
    const seccionesSectores = sectores
      .map((s, i) => seccionSector(s, i + 1, total))
      .join('')

    const cuerpo =
      seccionIntro(d) +
      seccionesSectores +
      seccionResultados(d) +
      seccionConclusiones(d)

    return body.split(MARCADOR).join(cuerpo)
  },
}
