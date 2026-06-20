/**
 * protocolo-engine.ts — Motor GENÉRICO de armado de protocolos SRT a PDF.
 *
 * Generaliza lo que render-protocolo.ts hacía SOLO para iluminación. Cada protocolo
 * aporta un ProtocoloDescriptor (HTML legal embebido + textos de carátula + función
 * de inyección de campos/grilla específica). El motor agrega lo COMPARTIDO: carátula,
 * watermark "Sigmetría App", banda de logos (empresa izq / consultora der), firma del
 * profesional, anexos y CSS, y delega el render a renderHtmlToPdf (Chromium).
 *
 * Iluminación sigue usando su propio render-protocolo.ts (no se toca, está en prod);
 * los protocolos NUEVOS (ruido, PAT, carga térmica, ergonomía, ...) usan este motor.
 */
import { renderHtmlToPdf } from './render-protocolo'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Datos COMPARTIDOS de carátula/cabecera/firma comunes a todos los protocolos. */
export interface DatosProtocoloBase {
  // Empresa / establecimiento
  razonSocial?: string
  cuit?: string
  direccion?: string
  localidad?: string
  provincia?: string
  cp?: string
  establecimiento?: string
  // Medición
  instrumento?: string
  calibracion?: string
  fechaMedicion?: string
  horaInicio?: string
  horaFin?: string
  // Profesional firmante
  profesional?: string
  matricula?: string
  firma?: string // data URL de la firma dibujada
  // Carátula
  numeroProtocolo?: string
  fechaEmision?: string
  fechaVencimiento?: string
  encomienda?: string
  // Logos (data URLs base64 para Chromium serverless)
  logoEmpresa?: string
  logoConsultora?: string
}

export interface ProtocoloDescriptor<TDatos extends DatosProtocoloBase = DatosProtocoloBase> {
  /** HTML legal embebido (string de protocolos-html.ts). */
  html: string
  /** Título de la carátula. Puede tener <br>. Ej: 'Medición de Ruido<br>en el Ambiente Laboral'. */
  titulo: string
  /** Norma. Ej: 'Res. SRT 85/2012'. */
  norma: string
  /** Párrafo de descripción de la carátula. */
  descripcion: string
  /** Párrafo de "Equipo utilizado" (interpola instrumento/calibración). */
  equipoTexto: (d: TDatos) => string
  /** Texto EXACTO de la firma en este HTML (difiere por protocolo: mayúsculas/punto final). */
  firmaTexto: string
  /** CSS extra de ajuste de tablas, específico del protocolo (opcional). */
  ajustesCss?: string
  /** Inyección de campos de texto + filas de grilla específicas del protocolo. */
  inyectarBody: (body: string, d: TDatos) => string
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS COMPARTIDOS
// ─────────────────────────────────────────────────────────────────────────────

/** Envuelve un valor en la tipografía de datos de la app (Poppins). */
export function D(v: string | number | undefined | null): string {
  const s = v == null || v === '' ? '—' : String(v)
  return `<span class="dato">${s}</span>`
}

/** Watermark: isotipo Sigmetría (triángulo lleno) + texto "Sigmetría App". */
const WM = `<div class="wm"><svg viewBox="0 0 240 200"><path d="M147 24 L46 188 L147 188 Z" fill="currentColor"/><path d="M153 24 L254 188 L153 188 Z" fill="currentColor"/></svg><div class="wm-txt">Sigmetría App</div></div>`

function protoLogos(d: DatosProtocoloBase): string {
  return `<div class="proto-logos"><div class="lg emp"><img src="${d.logoEmpresa ?? ''}"></div><div class="lg cons"><img src="${d.logoConsultora ?? ''}"></div></div>`
}

/** CSS compartido: carátula + anexos + watermark + dato + logos + firma. NO toca las
 *  tablas legales del protocolo (esos ajustes van en descriptor.ajustesCss). */
const SHARED_CSS = `
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
  /* Firma dibujada del profesional: compacta, debajo de la tabla, sin partirse ni saltar sola */
  .firma { position: relative; margin-top: 4px !important; break-inside: avoid; page-break-inside: avoid; }
  .firma::before { content:''; display:block; width:40mm; height:8mm; margin:0 auto -2mm; background:var(--firma-url) center/contain no-repeat; }
`

function caratula<T extends DatosProtocoloBase>(d: T, desc: ProtocoloDescriptor<T>): string {
  return `
<section class="hoja vert cover">${WM}
  <div class="cv-head"><div class="lg emp"><img src="${d.logoEmpresa ?? ''}"></div><div class="lg cons"><img src="${d.logoConsultora ?? ''}"></div></div>
  <div class="cv-folio">PROTOCOLO N° <b>${d.numeroProtocolo ?? '—'}</b> &nbsp;·&nbsp; Emitido ${d.fechaEmision ?? '—'}</div>
  <div class="cv-title"><div class="kick">Protocolo / Informe Técnico</div><h1>${desc.titulo}</h1><span class="norma">${desc.norma}</span></div>
  <div class="card">
    <div class="c"><div class="k">Empresa</div><div class="v">${d.razonSocial ?? '—'}</div></div>
    <div class="c"><div class="k">Establecimiento</div><div class="v">${d.establecimiento ?? '—'}</div></div>
    <div class="c"><div class="k">Fecha de ejecución</div><div class="v">${d.fechaMedicion ?? '—'}</div></div>
    <div class="c"><div class="k">Fecha de emisión</div><div class="v">${d.fechaEmision ?? '—'}</div></div>
    <div class="c"><div class="k">Profesional ejecutor</div><div class="v">${d.profesional ?? '—'}${d.matricula ? ` · Mat. ${d.matricula}` : ''}</div></div>
    <div class="c venc"><div class="k">Vence</div><div class="v">${d.fechaVencimiento ?? '—'}</div></div>
  </div>
  <h2 class="cv-sec">Descripción</h2>
  <p class="cv-p">${desc.descripcion}</p>
  <h2 class="cv-sec">Equipo utilizado</h2>
  <p class="cv-p">${desc.equipoTexto(d)}</p>
  <div class="cv-foot"><div class="emisor"><b>Emitido por: Consultora / Profesional</b>${d.encomienda ? `Encomienda Colegio Profesional N° ${d.encomienda}` : ''}</div><div class="qr"><div class="qrc"></div><div>Verificá la autenticidad</div></div></div>
  <div class="hoja-num">Carátula</div>
</section>`
}

function anexo(titulo: string, subtitulo: string, d: DatosProtocoloBase): string {
  return `<section class="hoja vert anx">${WM}<div class="cv-head"><div class="lg emp"><img src="${d.logoEmpresa ?? ''}"></div><div class="lg cons"><img src="${d.logoConsultora ?? ''}"></div></div><h2 class="anx-t">${titulo}</h2><p class="cv-p">${subtitulo}</p><div class="anx-box">DOCUMENTO ADJUNTO (PDF)</div></section>`
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR
// ─────────────────────────────────────────────────────────────────────────────

/** Arma el HTML completo del protocolo (carátula + body inyectado + anexos + CSS). */
export function ensamblarProtocolo<T extends DatosProtocoloBase>(
  desc: ProtocoloDescriptor<T>,
  d: T,
): string {
  const styleMatch = desc.html.match(/<style>([\s\S]*?)<\/style>/)
  const bodyMatch = desc.html.match(/<body>([\s\S]*?)<\/body>/)
  if (!styleMatch || !bodyMatch) {
    throw new Error('protocolo-engine: HTML del protocolo malformado (no se encontró <style> o <body>)')
  }
  const protoStyle = styleMatch[1]
  let protoBody = bodyMatch[1]

  // 1) Inyección específica del protocolo (campos de texto + filas de grilla).
  protoBody = desc.inyectarBody(protoBody, d)

  // 2) Watermark + banda de logos en cada hoja (marcadores compartidos por convención).
  protoBody = protoBody.split('<section class="hoja vert">').join(`<section class="hoja vert">${WM}${protoLogos(d)}`)
  protoBody = protoBody.split('<section class="hoja horiz">').join(`<section class="hoja horiz">${WM}${protoLogos(d)}`)

  // 3) Firma del profesional sobre la línea de firma legal.
  const firmaFind = `<div class="ac">${desc.firmaTexto}</div>`
  const firmaReplace = `<div class="ac"><b class="dato">${d.profesional ?? ''}</b>${d.matricula ? ` · Mat. ${d.matricula}` : ''}<br>${desc.firmaTexto}</div>`
  protoBody = protoBody.split(firmaFind).join(firmaReplace)

  // 4) Carátula + anexos (orden: matrícula → encomienda → calibración).
  const cara = caratula(d, desc)
  const anexos =
    anexo('Anexo I — Matrícula del Profesional', 'Credencial / matrícula vigente del profesional que ejecutó la medición.', d) +
    anexo('Anexo II — Encomienda del Colegio Profesional', 'Encomienda profesional emitida por el colegio correspondiente.', d) +
    anexo('Anexo III — Certificado de Calibración del Equipo', 'Último certificado de calibración del instrumento utilizado.', d)

  // 5) firma como CSS var (evita problemas de comillas en url()).
  const firmaVar = d.firma ? `:root{--firma-url:url("${d.firma}");}` : `:root{--firma-url:none;}`
  const extra = `${firmaVar}\n${SHARED_CSS}\n${desc.ajustesCss ?? ''}`

  return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&family=Poppins:wght@400;600&display=swap" rel="stylesheet">
<style>${protoStyle}\n${extra}</style></head>
<body>${cara}${protoBody}${anexos}</body></html>`
}

/** Genérico: arma el HTML del protocolo y lo renderiza a PDF con Chromium. */
export async function renderProtocolo<T extends DatosProtocoloBase>(
  desc: ProtocoloDescriptor<T>,
  d: T,
): Promise<Buffer> {
  return renderHtmlToPdf(ensamblarProtocolo(desc, d))
}
