/**
 * presupuesto-html.ts — Generador del HTML A4 de un PRESUPUESTO / cotización.
 *
 * Produce un documento autocontenido (`<html><head><style>@page{size:A4}…</style>…`)
 * listo para que `renderHtmlToPdf` (lib/pdf/render-protocolo.ts) lo renderice a PDF
 * vectorial con Chromium serverless.
 *
 * DISEÑO:
 *   - Encabezado con logo de la consultora (bucket público `consultora` → <img src>
 *     directo) o, si no hay logo, el nombre de la consultora como texto.
 *   - Bloque de datos del cliente / prospecto.
 *   - Concepto + tabla de ítems (tipo 'especifico') o monto único (tipo 'completo').
 *   - Validez de la oferta y total formateado (locale-aware vía formatMonto).
 *
 * Client-safe: solo arma strings, sin imports server. Los montos se formatean con
 * los helpers locale-aware de lib/finanzas/format (jamás hardcodear '$' ni 'dd/mm/yyyy').
 */

import { formatMonto, formatFechaCorta, FIN_MONEDA_DEFAULT, FIN_LOCALE_DEFAULT } from '@/lib/finanzas/format'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS
// ─────────────────────────────────────────────────────────────────────────────

export interface PresupuestoItem {
  descripcion: string
  monto: number
}

export interface PresupuestoDatos {
  // Identificación del documento
  numero?: string // folio visible, ej. "PRES-2026-00042" (opcional)
  fechaEmision: string // ISO date (YYYY-MM-DD) o ISO datetime
  validezDias?: number | null // vigencia de la oferta en días

  // Consultora (parte emisora)
  consultoraNombre: string
  consultoraCuit?: string | null
  consultoraTelefono?: string | null
  consultoraEmail?: string | null
  consultoraDomicilio?: string | null // domicilio_legal | domicilio_fiscal
  logoUrl?: string | null // bucket público 'consultora' → URL directa

  // Responsable técnico (opcional)
  responsableNombre?: string | null
  responsableTitulo?: string | null
  responsableMatricula?: string | null // "EMISOR N° NUMERO"

  // Cliente / prospecto (destinatario)
  clienteNombre: string
  clienteCuit?: string | null
  clienteEmail?: string | null
  clienteTelefono?: string | null
  clienteDomicilio?: string | null

  // Contenido
  concepto: string
  tipo: 'completo' | 'especifico'
  items?: PresupuestoItem[] // se listan si tipo='especifico'
  montoTotal: number
  notas?: string | null

  // Formato
  moneda?: string // ISO 4217 (default ARS)
  locale?: string // BCP 47 (default es-AR)
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function esc(v: string | null | undefined): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Fila opcional "label: valor" — se omite si el valor está vacío. */
function lineaDato(label: string, valor: string | null | undefined): string {
  if (!valor || !String(valor).trim()) return ''
  return `<div class="ln"><span class="ln-k">${esc(label)}</span><span class="ln-v">${esc(valor)}</span></div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function presupuestoHtml(datos: PresupuestoDatos): string {
  const moneda = datos.moneda || FIN_MONEDA_DEFAULT
  const locale = datos.locale || FIN_LOCALE_DEFAULT
  const money = (n: number) => formatMonto(n, moneda, locale)

  // Vencimiento de la oferta (fecha de emisión + validez en días)
  let vencimientoTxt = ''
  if (datos.validezDias && datos.validezDias > 0) {
    const base = new Date(datos.fechaEmision)
    if (!Number.isNaN(base.getTime())) {
      const venc = new Date(base.getTime() + datos.validezDias * 24 * 60 * 60 * 1000)
      vencimientoTxt = `${datos.validezDias} días — vence el ${formatFechaCorta(venc, locale)}`
    } else {
      vencimientoTxt = `${datos.validezDias} días`
    }
  }

  // Encabezado: logo si hay, si no el nombre de la consultora como texto.
  const headerMarca = datos.logoUrl
    ? `<img class="logo" src="${esc(datos.logoUrl)}" alt="${esc(datos.consultoraNombre)}">`
    : `<div class="marca-txt">${esc(datos.consultoraNombre)}</div>`

  // Datos del emisor (consultora) bajo la marca.
  const emisorDatos = [
    datos.logoUrl ? `<div class="emisor-nombre">${esc(datos.consultoraNombre)}</div>` : '',
    lineaDato('CUIT', datos.consultoraCuit),
    lineaDato('Domicilio', datos.consultoraDomicilio),
    lineaDato('Tel.', datos.consultoraTelefono),
    lineaDato('Email', datos.consultoraEmail),
  ].join('')

  // Datos del cliente / prospecto.
  const clienteDatos = [
    lineaDato('CUIT', datos.clienteCuit),
    lineaDato('Domicilio', datos.clienteDomicilio),
    lineaDato('Tel.', datos.clienteTelefono),
    lineaDato('Email', datos.clienteEmail),
  ].join('')

  // Cuerpo: tabla de ítems (especifico) o concepto + monto único (completo).
  let cuerpo = ''
  if (datos.tipo === 'especifico' && datos.items && datos.items.length > 0) {
    const filas = datos.items
      .map(
        (it) =>
          `<tr><td class="desc">${esc(it.descripcion)}</td><td class="num">${money(it.monto)}</td></tr>`,
      )
      .join('')
    cuerpo = `
      <table class="items">
        <thead><tr><th>Detalle</th><th class="num">Importe</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`
  } else {
    // 'completo' (o 'especifico' sin ítems): concepto como descripción + monto único.
    cuerpo = `
      <table class="items">
        <thead><tr><th>Detalle</th><th class="num">Importe</th></tr></thead>
        <tbody><tr><td class="desc">${esc(datos.concepto)}</td><td class="num">${money(datos.montoTotal)}</td></tr></tbody>
      </table>`
  }

  // Bloque de responsable técnico (firma) — opcional.
  const responsable = datos.responsableNombre
    ? `<div class="firma">
        <div class="firma-linea"></div>
        <div class="firma-nombre">${esc(datos.responsableNombre)}</div>
        ${datos.responsableTitulo ? `<div class="firma-sub">${esc(datos.responsableTitulo)}</div>` : ''}
        ${datos.responsableMatricula ? `<div class="firma-sub">Mat. ${esc(datos.responsableMatricula)}</div>` : ''}
      </div>`
    : ''

  const folioTxt = datos.numero ? `Presupuesto N° <b>${esc(datos.numero)}</b>` : 'Presupuesto'

  return `<!DOCTYPE html><html lang="${esc(locale)}"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 16mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Poppins','Segoe UI',sans-serif; color:#222; font-size:10.5pt; line-height:1.45; margin:0; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #2E7D33; padding-bottom:6mm; }
  .head .marca { max-width:60%; }
  .logo { max-width:60mm; max-height:22mm; object-fit:contain; display:block; }
  .marca-txt { font-family:'Montserrat',sans-serif; font-size:18pt; font-weight:800; color:#2E7D33; }
  .emisor-nombre { font-family:'Montserrat',sans-serif; font-weight:700; font-size:11pt; color:#1f2d1f; margin-bottom:2px; }
  .head .doc { text-align:right; font-size:9pt; color:#666; }
  .head .doc .folio { font-size:11pt; color:#222; } .head .doc .folio b { color:#2E7D33; }
  .ln { display:flex; gap:6px; font-size:8.5pt; line-height:1.5; }
  .ln-k { color:#888; min-width:18mm; } .ln-v { color:#333; font-weight:500; }
  .meta { display:flex; gap:6mm; margin-top:6mm; }
  .meta .box { flex:1; border:1px solid #E4E8E4; border-radius:8px; padding:4mm 5mm; }
  .meta .box h3 { margin:0 0 3px; font-family:'Montserrat',sans-serif; font-size:8pt; letter-spacing:1px; text-transform:uppercase; color:#2E7D33; }
  .meta .box .nombre { font-size:11pt; font-weight:600; margin-bottom:3px; }
  .concepto { margin-top:7mm; }
  .concepto h2 { font-family:'Montserrat',sans-serif; font-size:10pt; letter-spacing:.5px; text-transform:uppercase; color:#888; margin:0 0 2px; }
  .concepto p { margin:0; font-size:11pt; font-weight:500; }
  table.items { width:100%; border-collapse:collapse; margin-top:6mm; }
  table.items th { background:#2E7D33; color:#fff; font-family:'Montserrat',sans-serif; font-size:8.5pt; letter-spacing:.5px; text-align:left; padding:6px 10px; }
  table.items th.num, table.items td.num { text-align:right; white-space:nowrap; }
  table.items td { padding:7px 10px; border-bottom:1px solid #ECECEC; font-size:10pt; vertical-align:top; }
  table.items td.desc { width:75%; }
  .total { display:flex; justify-content:flex-end; margin-top:5mm; }
  .total .box { min-width:70mm; border:1px solid #E4E8E4; border-radius:8px; overflow:hidden; }
  .total .row { display:flex; justify-content:space-between; padding:7px 12px; }
  .total .row.t { background:#F4F8F4; font-family:'Montserrat',sans-serif; font-weight:800; font-size:12pt; color:#2E7D33; border-top:1px solid #E4E8E4; }
  .total .row .lbl { color:#666; }
  .validez { margin-top:6mm; font-size:9.5pt; color:#555; }
  .validez b { color:#9A7B00; }
  .notas { margin-top:5mm; font-size:9pt; color:#666; white-space:pre-wrap; border-left:3px solid #E4E8E4; padding-left:4mm; }
  .firma { margin-top:18mm; width:70mm; text-align:center; }
  .firma-linea { border-top:1px solid #888; margin-bottom:3px; }
  .firma-nombre { font-weight:600; font-size:10pt; }
  .firma-sub { font-size:8.5pt; color:#777; }
</style></head>
<body>
  <div class="head">
    <div class="marca">${headerMarca}<div class="emisor">${emisorDatos}</div></div>
    <div class="doc">
      <div class="folio">${folioTxt}</div>
      <div>Fecha: ${esc(formatFechaCorta(datos.fechaEmision, locale))}</div>
    </div>
  </div>

  <div class="meta">
    <div class="box">
      <h3>Cliente</h3>
      <div class="nombre">${esc(datos.clienteNombre)}</div>
      ${clienteDatos}
    </div>
  </div>

  <div class="concepto">
    <h2>Concepto</h2>
    <p>${esc(datos.concepto)}</p>
  </div>

  ${cuerpo}

  <div class="total">
    <div class="box">
      <div class="row t"><span class="lbl">Total</span><span>${money(datos.montoTotal)}</span></div>
    </div>
  </div>

  ${vencimientoTxt ? `<div class="validez">Validez de la oferta: <b>${esc(vencimientoTxt)}</b></div>` : ''}
  ${datos.notas && datos.notas.trim() ? `<div class="notas">${esc(datos.notas)}</div>` : ''}

  ${responsable}
</body></html>`
}
