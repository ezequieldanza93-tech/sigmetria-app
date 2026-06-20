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
  /** Estado de cumplimiento (true → "✓ Cumple", false → "No cumple", null → sin dato). */
  cumple: boolean | null
}

/** Datos del Informe de Carga de Fuego: base compartida + sectores data-driven. */
export interface DatosProtocoloCargaFuego extends DatosProtocoloBase {
  /** Sectores de incendio relevados. Al menos uno (el legacy se trata como 1 sector). */
  sectores: SectorCargaFuego[]
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
    `<td class="num">${D(m.coefC)}</td>` +
    `<td class="num">${D(m.equivMadera)}</td>` +
    `</tr>`
  )
}

/** Chip de estado de cumplimiento. */
function chipCumple(cumple: boolean | null): string {
  if (cumple === true) return `<span class="chip">✓ Cumple</span>`
  if (cumple === false) return `<span class="chip no">No cumple</span>`
  return `<span class="chip na">Sin dato</span>`
}

/**
 * Sección de UN sector → `<section class="hoja vert">`.
 * El motor le estampa watermark + logos al inicio (split sobre el tag de apertura) y,
 * si esta sección incluye el bloque de firma, también el firmante.
 *
 * @param s        sector a renderizar
 * @param idx      índice (1..N) para el numerador de hoja
 * @param total    total de sectores
 * @param conFirma si true, agrega el bloque de firma (solo la última sección)
 */
function seccionSector(s: SectorCargaFuego, idx: number, total: number, conFirma: boolean): string {
  const filas = s.materiales.length > 0
    ? s.materiales.map(filaMaterial).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#7b8a7b;padding:12px;">Sin materiales relevados en este sector.</td></tr>`

  const firma = conFirma
    ? `<div class="firmline"><div class="linea">………………………………………………</div><div class="ac">${FIRMA_TEXTO}</div></div>`
    : ''

  // El encabezado de cuerpo (kick + título) va solo en la primera sección.
  const cabecera = idx === 1
    ? `<div class="kick">Memoria de cálculo · Dec. 351/79 (Anexo VII)</div>
       <h3 class="t">Cálculo de Carga de Fuego</h3>
       <p class="lead">Determinación de la carga de fuego ponderada (equivalente en madera) por sector de incendio, conforme al método del Dec. 351/79 (Anexo VII), para establecer el riesgo, la resistencia al fuego exigida y el potencial extintor mínimo de cada sector.</p>`
    : ''

  return `<section class="hoja vert"><div class="cf">
  ${cabecera}
  <div class="secbar"><span class="dot"></span><h4>${D(s.nombre)}</h4><span class="meta">Superficie&nbsp;·&nbsp;${D(s.superficie)}</span></div>
  <table>
    <thead>
      <tr><th>Material</th><th>Estado</th><th class="num">Peso</th><th class="num">PCI</th><th class="num">Coef. C</th><th class="num">Equiv. madera</th></tr>
    </thead>
    <tbody>
      ${filas}
      <tr class="total"><td colspan="5">Equivalente en madera total (Σ)</td><td class="num">${D(s.equivTotal)}</td></tr>
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
  ${firma}
  <div class="hoja-num">Sector ${idx} de ${total}</div>
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

    // Caso sin sectores: una sección "vacía" con el bloque de firma, para que el
    // informe nunca quede sin cuerpo ni firmante.
    if (total === 0) {
      const vacio = `<section class="hoja vert"><div class="cf">
  <div class="kick">Memoria de cálculo · Dec. 351/79 (Anexo VII)</div>
  <h3 class="t">Cálculo de Carga de Fuego</h3>
  <p class="lead">No se registraron sectores de incendio en este cálculo.</p>
  <div class="firmline"><div class="linea">………………………………………………</div><div class="ac">${FIRMA_TEXTO}</div></div>
</div></section>`
      return body.split(MARCADOR).join(vacio)
    }

    const secciones = sectores
      .map((s, i) => seccionSector(s, i + 1, total, i === total - 1))
      .join('')

    return body.split(MARCADOR).join(secciones)
  },
}
