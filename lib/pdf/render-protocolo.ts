/**
 * render-protocolo.ts — Motor server-side de generación de PDFs de protocolos legales.
 *
 * ARQUITECTURA:
 *   - Toma un HTML legal (ya extraído como string en protocolos-html.ts),
 *     inyecta datos, arma carátula + anexos + watermark, y lanza Chromium
 *     headless para renderizar a PDF vectorial respetando @page CSS.
 *   - Branching de entorno:
 *       Producción (VERCEL=1 o NODE_ENV=production): @sparticuz/chromium + puppeteer-core
 *       Local (dev): playwright-core Chromium + puppeteer-core
 *
 * IMPORTANTE: este módulo es SERVER-ONLY. No lo importes desde componentes
 * React ni desde código que pueda correr en el cliente.
 *
 * FASE A: datos MOCK hardcodeados. La inyección de datos reales es Fase B.
 */

// server-only guard implícito: puppeteer-core y @sparticuz/chromium no están
// disponibles en el runtime de cliente. No se agrega 'use server' porque este
// módulo es una función de librería, no un Server Action.

import type { Browser } from 'puppeteer-core'
import { PROTOCOLO_ILUMINACION_HTML } from './protocolos-html'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Datos que se inyectan en el protocolo.
 * Fase A: todos tienen valores por defecto (mock). Fase B: el caller los provee.
 */
export interface DatosProtocoloIluminacion {
  // Empresa
  razonSocial?: string
  direccion?: string
  localidad?: string
  provincia?: string
  cp?: string
  cuit?: string
  // Medición
  instrumento?: string
  calibracion?: string
  fechaMedicion?: string
  horaInicio?: string
  horaFin?: string
  // Profesional
  profesional?: string
  matricula?: string
  firma?: string // data URL SVG/PNG de la firma dibujada
  // Carátula
  numeroProtocolo?: string
  fechaEmision?: string
  establecimiento?: string
  fechaVencimiento?: string
  encomienda?: string
  // Logos
  logoEmpresa?: string // data URL
  logoConsultora?: string // data URL
  // Filas de medición (tabla hoja 2)
  mediciones?: MedicionRow[]
}

export interface MedicionRow {
  n: number
  hora: string
  sector: string
  seccionPuesto: string
  tipoIluminacion: string
  tipofuente: string
  iluminacion: string
  uniformidad: string
  valorMedido: string
  valorLegal: string
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS MOCK (Fase A)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_DATOS: Required<DatosProtocoloIluminacion> = {
  razonSocial: 'Industrias Ejemplo S.A.',
  direccion: 'Av. Industrial 4500',
  localidad: 'Rosario',
  provincia: 'Santa Fe',
  cp: 'S2002',
  cuit: '30-98765432-1',
  instrumento: 'Luxómetro XYZ LX-200 · N° 18A-9921',
  calibracion: '02/2026',
  fechaMedicion: '16/06/2026',
  horaInicio: '09:00',
  horaFin: '11:30',
  profesional: 'Ing. Juan Pérez',
  matricula: 'COPIME 12345',
  firma: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 60'><path d='M8 44 C26 8 36 54 52 30 C66 10 78 50 96 32 C112 16 120 52 140 28 C156 10 172 48 198 22' fill='none' stroke='%231b2b6b' stroke-width='3' stroke-linecap='round'/></svg>",
  numeroProtocolo: 'SIG-2026-00042',
  fechaEmision: '17/06/2026',
  establecimiento: 'Planta Norte — Depósito B',
  fechaVencimiento: '16/06/2027',
  encomienda: 'EC-2026-0033 · CABA y Pcia. Bs. As.',
  logoEmpresa:
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 80'><ellipse cx='100' cy='40' rx='96' ry='33' fill='%23003478'/><text x='100' y='54' font-family='Georgia,serif' font-style='italic' font-weight='bold' font-size='38' fill='white' text-anchor='middle'>Ford</text></svg>",
  logoConsultora:
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 250 70'><g fill='none' stroke='%23888' stroke-width='7'><circle cx='40' cy='35' r='28'/><circle cx='92' cy='35' r='28'/><circle cx='144' cy='35' r='28'/><circle cx='196' cy='35' r='28'/></g></svg>",
  mediciones: [
    { n: 1, hora: '09:05', sector: 'Depósito', seccionPuesto: 'Pasillo A', tipoIluminacion: 'Mixta', tipofuente: 'Descarga', iluminacion: 'General', uniformidad: 'Cumple', valorMedido: '210', valorLegal: '200' },
    { n: 2, hora: '09:20', sector: 'Depósito', seccionPuesto: 'Estiba 1', tipoIluminacion: 'Artificial', tipofuente: 'Descarga', iluminacion: 'General', uniformidad: 'Cumple', valorMedido: '185', valorLegal: '200' },
    { n: 3, hora: '09:40', sector: 'Oficina', seccionPuesto: 'Escritorio', tipoIluminacion: 'Mixta', tipofuente: 'Mixta', iluminacion: 'Localizada', uniformidad: 'Cumple', valorMedido: '520', valorLegal: '500' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// ENSAMBLADOR HTML
// ─────────────────────────────────────────────────────────────────────────────

function D(v: string): string {
  return `<span class="dato">${v}</span>`
}

function rowVacio(n: number): string {
  return `<tr><td class="idx">${n}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
}

function rowMedicion(m: MedicionRow): string {
  const vals = [m.hora, m.sector, m.seccionPuesto, m.tipoIluminacion, m.tipofuente, m.iluminacion, m.uniformidad, m.valorMedido, m.valorLegal]
  return `<tr><td class="idx">${m.n}</td>` + vals.map(v => `<td>${D(v)}</td>`).join('') + `</tr>`
}

function ensamblarHtml(datos: Required<DatosProtocoloIluminacion>): string {
  const raw = PROTOCOLO_ILUMINACION_HTML

  // Extraer style y body del HTML del protocolo
  const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/)
  const bodyMatch = raw.match(/<body>([\s\S]*?)<\/body>/)
  if (!styleMatch || !bodyMatch) {
    throw new Error('render-protocolo: HTML del protocolo malformado (no se encontró <style> o <body>)')
  }
  const protoStyle = styleMatch[1]
  let protoBody = bodyMatch[1]

  // ── Inyección de campos de texto ──
  const campos: [string, string][] = [
    ['Razón Social:</td>', `Razón Social: ${D(datos.razonSocial)}</td>`],
    ['Dirección:</td>', `Dirección: ${D(datos.direccion)}</td>`],
    ['Localidad:</td>', `Localidad: ${D(datos.localidad)}</td>`],
    ['Provincia:</td>', `Provincia: ${D(datos.provincia)}</td>`],
    ['C.P.:</td>', `C.P.: ${D(datos.cp)}</td>`],
    ['C.U.I.T.:</td>', `C.U.I.T.: ${D(datos.cuit)}</td>`],
    ['del instrumento utilizado:</td>', `del instrumento utilizado: ${D(datos.instrumento)}</td>`],
    ['utilizado en la medición:</td>', `utilizado en la medición: ${D(datos.calibracion)}</td>`],
    ['Fecha de la Medición:</td>', `Fecha de la Medición: ${D(datos.fechaMedicion)}</td>`],
    ['Hora de Inicio:</td>', `Hora de Inicio: ${D(datos.horaInicio)}</td>`],
    ['Hora de Finalización:</td>', `Hora de Finalización: ${D(datos.horaFin)}</td>`],
  ]
  for (const [find, replace] of campos) {
    protoBody = protoBody.split(find).join(replace)
  }

  // ── Inyección de filas de medición ──
  for (const m of datos.mediciones) {
    protoBody = protoBody.replace(rowVacio(m.n), rowMedicion(m))
  }

  // ── Watermark (isotipo Sigmetría + texto) ──
  const WM = `<div class="wm"><svg viewBox="0 0 240 200"><path d="M147 24 L46 188 L147 188 Z" fill="currentColor"/><path d="M153 24 L254 188 L153 188 Z" fill="currentColor"/></svg><div class="wm-txt">Sigmetría App</div></div>`

  // ── Banda de logos (empresa izq / consultora der) en cada hoja del protocolo ──
  const PROTO_LOGOS = `<div class="proto-logos"><div class="lg emp"><img src="${datos.logoEmpresa}"></div><div class="lg cons"><img src="${datos.logoConsultora}"></div></div>`
  protoBody = protoBody.split('<section class="hoja vert">').join(`<section class="hoja vert">${WM}${PROTO_LOGOS}`)
  protoBody = protoBody.split('<section class="hoja horiz">').join(`<section class="hoja horiz">${WM}${PROTO_LOGOS}`)

  // ── Firma del profesional ──
  protoBody = protoBody
    .split('<div class="ac">Firma, Aclaración y Registro del Profesional Interviniente</div>')
    .join(`<div class="ac"><b class="dato">${datos.profesional}</b> · Mat. ${datos.matricula}<br>Firma, Aclaración y Registro del Profesional Interviniente</div>`)

  // ── Carátula ──
  const caratula = `
<section class="hoja vert cover">${WM}
  <div class="cv-head"><div class="lg emp"><img src="${datos.logoEmpresa}"></div><div class="lg cons"><img src="${datos.logoConsultora}"></div></div>
  <div class="cv-folio">PROTOCOLO N° <b>${datos.numeroProtocolo}</b> &nbsp;·&nbsp; Emitido ${datos.fechaEmision}</div>
  <div class="cv-title"><div class="kick">Protocolo / Informe Técnico</div><h1>Medición de Iluminación<br>en el Ambiente Laboral</h1><span class="norma">Res. SRT 84/2012</span></div>
  <div class="card">
    <div class="c"><div class="k">Empresa</div><div class="v">${datos.razonSocial}</div></div>
    <div class="c"><div class="k">Establecimiento</div><div class="v">${datos.establecimiento}</div></div>
    <div class="c"><div class="k">Fecha de ejecución</div><div class="v">${datos.fechaMedicion}</div></div>
    <div class="c"><div class="k">Fecha de emisión</div><div class="v">${datos.fechaEmision}</div></div>
    <div class="c"><div class="k">Profesional ejecutor</div><div class="v">${datos.profesional} · Mat. ${datos.matricula}</div></div>
    <div class="c venc"><div class="k">Vence (vigencia anual)</div><div class="v">${datos.fechaVencimiento}</div></div>
  </div>
  <h2 class="cv-sec">Descripción</h2>
  <p class="cv-p">Medición de niveles de iluminación en los puestos de trabajo del establecimiento, conforme a la Res. SRT 84/2012, para verificar el cumplimiento de los valores legales del Dec. 351/79 (Anexo IV).</p>
  <h2 class="cv-sec">Equipo utilizado</h2>
  <p class="cv-p">${datos.instrumento} · Clase B. <b>Último certificado de calibración:</b> ${datos.calibracion} (vigente, se adjunta como anexo).</p>
  <div class="cv-foot"><div class="emisor"><b>Emitido por: Consultora / Profesional</b>Encomienda Colegio Profesional N° ${datos.encomienda}</div><div class="qr"><div class="qrc"></div><div>Verificá la autenticidad</div></div></div>
  <div class="hoja-num">Carátula</div>
</section>`

  // ── Función auxiliar para anexos ──
  function anexo(titulo: string, subtitulo: string): string {
    return `<section class="hoja vert anx">${WM}<div class="cv-head"><div class="lg emp"><img src="${datos.logoEmpresa}"></div><div class="lg cons"><img src="${datos.logoConsultora}"></div></div><h2 class="anx-t">${titulo}</h2><p class="cv-p">${subtitulo}</p><div class="anx-box">DOCUMENTO ADJUNTO (PDF)</div></section>`
  }

  // ── Anexos (orden: matrícula → encomienda → calibración) ──
  const anexos =
    anexo('Anexo I — Matrícula del Profesional', 'Credencial / matrícula vigente del profesional que ejecutó la medición (usuario que cargó los datos).') +
    anexo('Anexo II — Encomienda del Colegio Profesional', 'Encomienda profesional emitida por el colegio correspondiente.') +
    anexo('Anexo III — Certificado de Calibración del Equipo', 'Último certificado de calibración del instrumento utilizado en la medición.')

  // ── Estilos extra (carátula + anexos + datos + watermark + ajustes de presentación) ──
  const extra = `
  .dato { font-family: 'Poppins','Segoe UI',sans-serif; color:#1f2d1f; font-weight:600; }
  .cover, .anx { font-family: 'Montserrat','Poppins',sans-serif; color:#333; position:relative; }
  .hoja { position:relative; }
  .hoja > *:not(.wm) { position:relative; z-index:1; }
  .wm { position:absolute; inset:0; z-index:0; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:.05; color:#333; pointer-events:none; }
  .wm svg { width:56mm; } .wm .wm-txt { font-size:9mm; font-weight:700; letter-spacing:2px; margin-top:3mm; }
  .cv-head, .anx .cv-head { display:flex; justify-content:space-between; align-items:center; position:relative; z-index:1; }
  .lg { display:flex; align-items:center; justify-content:center; width:31mm; height:11mm; }
  .lg.emp { justify-content:flex-start; } .lg.cons { justify-content:flex-end; }
  .proto-logos { display:flex; justify-content:space-between; align-items:center; margin:0 0 3mm; }
  .lg img { max-width:100%; max-height:100%; object-fit:contain; }
  .cv-folio { position:relative; z-index:1; font-size:8pt; color:#888; margin-top:4px; }
  .cv-folio b { color:#2E7D33; }
  .cv-title { position:relative; z-index:1; text-align:center; margin-top:24mm; }
  .cv-title .kick { font-size:10pt; letter-spacing:3px; color:#888; text-transform:uppercase; }
  .cv-title h1 { font-size:28pt; font-weight:800; margin:8px 0 6px; line-height:1.12; }
  .cv-title .norma { display:inline-block; background:#2E7D33; color:#fff; font-size:9pt; font-weight:700; padding:3px 14px; border-radius:100px; }
  .card { position:relative; z-index:1; margin-top:18mm; border:1px solid #E4E8E4; border-radius:10px; overflow:hidden; display:grid; grid-template-columns:1fr 1fr; }
  .card .c { padding:9px 14px; border-bottom:1px solid #E4E8E4; } .card .c:nth-child(odd){ border-right:1px solid #E4E8E4; }
  .card .k { font-size:7.5pt; letter-spacing:.5px; text-transform:uppercase; color:#888; font-family:'Poppins',sans-serif; }
  .card .v { font-size:11pt; font-weight:600; margin-top:1px; font-family:'Poppins',sans-serif; }
  .card .venc { background:#FFF8E1; } .card .venc .v { color:#9A7B00; }
  .cv-sec, .anx-t { position:relative; z-index:1; font-size:13pt; font-weight:700; color:#2E7D33; border-bottom:1px solid #E4E8E4; padding-bottom:3px; margin:14mm 0 6px; }
  .cv-p { position:relative; z-index:1; font-family:'Poppins',sans-serif; font-size:10pt; line-height:1.5; }
  .cv-foot { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-end; margin-top:14mm; }
  .emisor { font-size:8pt; color:#888; font-family:'Poppins',sans-serif; } .emisor b { color:#333; display:block; font-size:9.5pt; }
  .qr { text-align:center; font-size:6.5pt; color:#888; } .qr .qrc { width:22mm; height:22mm; background:conic-gradient(#000 25%,#fff 0 50%,#000 0 75%,#fff 0) 0 0/7px 7px,#000; border:3px solid #000; margin:0 auto 3px; }
  .anx-box { position:relative; z-index:1; border:1px solid #E4E8E4; border-radius:8px; min-height:170mm; margin-top:8px; display:flex; align-items:center; justify-content:center; color:#9aa6b2; font-family:'Poppins',sans-serif; font-weight:600;
    background: repeating-linear-gradient(0deg,#eef3f7,#eef3f7 1px,#fff 1px,#fff 22px), repeating-linear-gradient(90deg,#eef3f7,#eef3f7 1px,#fff 1px,#fff 22px); }

  /* ── Ajustes de PRESENTACIÓN del protocolo (no modifican el HTML legal) ── */
  .hoja.horiz table.med { width: 94%; margin: 0 auto; }
  .hoja.horiz table.med td.idx { height: 5.5mm; }
  .hoja.horiz table.med .obs { height: 22mm; }
  .hoja.horiz table.analisis .col-an { height: 90mm; }
  .hoja.vert table.form { width: 96%; margin: 0 auto; }
  .hoja.vert td[style*="height:40mm"] { height: 22mm !important; }
  .hoja.vert td[style*="height:34mm"] { height: 18mm !important; }
  .hoja.vert td[style*="height:32mm"] { height: 18mm !important; }
  .hoja.vert td[style*="height:30mm"] { height: 18mm !important; }

  /* Firma del profesional */
  .firma { position: relative; }
  .firma::before { content:''; display:block; width:44mm; height:11mm; margin:0 auto -4mm; background:url("${datos.firma}") center/contain no-repeat; }

  /* Unificar márgenes */
  .hoja.horiz .anexo, .hoja.horiz .titulo, .hoja.horiz table.form,
  .hoja.horiz table.analisis, .hoja.horiz .hoja-num, .hoja.horiz .proto-logos { width:94%; margin-left:auto; margin-right:auto; }
  .hoja.vert .anexo, .hoja.vert .titulo, .hoja.vert .hoja-num, .hoja.vert .proto-logos { width:96%; margin-left:auto; margin-right:auto; }
`

  return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&family=Poppins:wght@400;600&display=swap" rel="stylesheet">
<style>${protoStyle}\n${extra}</style></head>
<body>${caratula}${protoBody}${anexos}</body></html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE ENTORNO Y LAUNCH DE CHROMIUM
// ─────────────────────────────────────────────────────────────────────────────

async function getBrowserExecutablePath(): Promise<string> {
  const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === 'production'

  if (isVercel) {
    // Producción: @sparticuz/chromium descarga / provee el binario optimizado para AWS Lambda / Vercel
    const chromium = (await import('@sparticuz/chromium')).default
    return chromium.executablePath()
  } else {
    // Local: Chromium de Playwright (ya instalado, no necesita descarga extra)
    const { chromium: pwChromium } = await import('playwright-core')
    return pwChromium.executablePath()
  }
}

async function launchBrowser(): Promise<Browser> {
  const { launch } = await import('puppeteer-core')
  const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === 'production'

  // Args comunes para entorno serverless / sin GPU
  const serverlessArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ]

  if (isVercel) {
    // @sparticuz/chromium v149: solo expone args y executablePath (sin headless/defaultViewport)
    const chromium = (await import('@sparticuz/chromium')).default
    return launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    })
  } else {
    const executablePath = await getBrowserExecutablePath()
    return launch({
      executablePath,
      headless: true,
      args: serverlessArgs,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el PDF del Protocolo de Iluminación (Res. SRT 84/2012).
 *
 * @param datos - Datos a inyectar. En Fase A todos son opcionales (usa mock si se omiten).
 * @returns Buffer con el contenido del PDF.
 */
export async function renderProtocoloPdf(
  datos: DatosProtocoloIluminacion = {}
): Promise<Buffer> {
  // Merge datos del caller con los mock (los del caller tienen prioridad)
  const datosCompletos: Required<DatosProtocoloIluminacion> = {
    ...MOCK_DATOS,
    ...datos,
    // Arrays: si el caller no los provee, usamos mock
    mediciones: datos.mediciones ?? MOCK_DATOS.mediciones,
  }

  const html = ensamblarHtml(datosCompletos)

  let browser: Browser | null = null
  try {
    console.warn('[PDF-RENDER] lanzando browser', { isVercel: !!process.env.VERCEL || process.env.NODE_ENV === 'production' })
    browser = await launchBrowser()
    console.warn('[PDF-RENDER] browser lanzado, abriendo página')
    const page = await browser.newPage()

    // setContent de puppeteer-core SOLO acepta 'load' | 'domcontentloaded' (networkidle
    // es solo para goto). El bug del "texto superpuesto" era que con 'load' el PDF se
    // generaba antes de que Google Fonts (Montserrat/Poppins) cargara → fuente de
    // reemplazo → layout roto. El fix NO es el waitUntil: es FORZAR la carga de las
    // fuentes con document.fonts.load() (abajo) antes de page.pdf().
    await page.setContent(html, { waitUntil: 'load' })

    // Doble seguro: forzar la carga de cada familia/peso usados y esperar a que se
    // apliquen, así el layout se mide con las fuentes correctas (no con el fallback).
    await page.evaluate(async () => {
      try {
        await Promise.all([
          document.fonts.load('700 16px Montserrat'),
          document.fonts.load('500 16px Montserrat'),
          document.fonts.load('800 16px Montserrat'),
          document.fonts.load('400 16px Poppins'),
          document.fonts.load('600 16px Poppins'),
        ])
      } catch {
        /* si alguna familia no resuelve, igual seguimos con document.fonts.ready */
      }
      await document.fonts.ready
    })

    const pdfBuffer = await page.pdf({
      preferCSSPageSize: true,  // respeta @page { size: A4 portrait/landscape }
      printBackground: true,    // incluye colores de fondo (carátula, encabezados, etc.)
    })

    console.warn('[PDF-RENDER] PDF generado', { bytes: pdfBuffer.length })
    return Buffer.from(pdfBuffer)
  } catch (err) {
    console.error('[PDF-RENDER] error generando PDF:', err instanceof Error ? (err.stack ?? err.message) : String(err))
    throw err
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
