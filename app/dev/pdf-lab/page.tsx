'use client'

/**
 * /dev/pdf-lab — Taller en vivo del molde de reportes (enfoque HTML → captura)
 *
 * Las hojas A4 se maquetan en HTML/CSS REAL y se ven en pantalla tal cual van a
 * salir (este es el preview, sin react-pdf ni visores). Controles a la izquierda
 * actualizan el layout al instante. El botón "Descargar PDF" usa el motor
 * existente lib/pdf/protocolo-pdf.ts, que captura HOJA POR HOJA (1 hoja = 1
 * página A4), evitando los cortes que partían el contenido.
 *
 * Claves anti-bug:
 *  - Layout por FLUJO (flex column: header / contenido / footer) → nada se
 *    superpone, el footer nunca pisa el contenido.
 *  - Fotos como cajas con background-size:cover → html2canvas NO las deforma
 *    (el object-fit de <img> a veces lo ignora).
 *
 * SOLO desarrollo.  npm run dev → http://localhost:3000/dev/pdf-lab
 */

import { useRef, useState } from 'react'

const MM = 3.7795 // 1mm en px @96dpi
const A4_W = 794
const A4_H = 1123

const C = {
  verde: '#4CAF50', verdeOscuro: '#2E7D33', ink: '#333333', gris: '#888888',
  borde: '#E4E8E4', blanco: '#FFFFFF', amarillo: '#FFDE41', rojo: '#E53935',
}

const DEFAULTS = {
  marginTopMm: 14,
  marginBottomMm: 12,
  marginLeftMm: 14,
  marginRightMm: 14,
  logoConsultoraW: 150,
  logoEmpresaW: 120,
  logoH: 46,
  watermarkOpacityPct: 5,
  watermarkW: 320,
  tituloPx: 19,
  datosPx: 12,
  h2Px: 17,
  bodyPx: 13,
  captionPx: 10,
  fotoGrandeH: 240,
  fotoGridH: 170,
}
type Params = typeof DEFAULTS

const Isotipo = ({ size }: { size: number }) => (
  <svg width={size} height={size * 0.83} viewBox="0 0 240 200" style={{ display: 'block' }}>
    <path d="M147 24 L46 188 L147 188 Z" fill="currentColor" />
    <path d="M153 24 L254 188 L153 188 Z" fill="none" stroke="currentColor" strokeWidth={6} />
  </svg>
)

// Caja de imagen anti-deformación (background cover) — placeholder local.
function PhotoBox({ h, label, w = '100%' }: { h: number; label: string; w?: number | string }) {
  return (
    <div style={{ width: w, marginBottom: 6 }}>
      <div
        style={{
          width: '100%', height: h, borderRadius: 4, border: `1px solid ${C.borde}`,
          background: `repeating-linear-gradient(45deg, #eef0ee, #eef0ee 12px, #e6e8e6 12px, #e6e8e6 24px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.gris, fontSize: 12, fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function LogoBox({ w, h, label, accent }: { w: number; h: number; label: string; accent?: boolean }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: 4,
        border: `1px dashed ${accent ? C.verde : C.borde}`,
        background: accent ? '#F2F8F2' : '#fafafa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent ? C.verdeOscuro : C.gris, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
      }}
    >
      {label}
    </div>
  )
}

function Sheet({ p, children, refCb }: { p: Params; children: React.ReactNode; refCb: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={refCb}
      style={{
        width: A4_W, height: A4_H, background: C.blanco, position: 'relative', overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)', flexShrink: 0,
        paddingTop: p.marginTopMm * MM, paddingBottom: p.marginBottomMm * MM,
        paddingLeft: p.marginLeftMm * MM, paddingRight: p.marginRightMm * MM,
        boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        fontFamily: 'Montserrat, "Open Sans", system-ui, sans-serif', color: C.ink,
      }}
    >
      {/* Marca de agua */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: p.watermarkOpacityPct / 100, color: C.ink, pointerEvents: 'none' }}>
        <Isotipo size={p.watermarkW} />
        <div style={{ fontSize: p.watermarkW * 0.16, fontWeight: 700, letterSpacing: 2, marginTop: 8 }}>SIGMETRÍA</div>
      </div>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <LogoBox w={p.logoConsultoraW} h={p.logoH} label="LOGO CONSULTORA" accent />
          <LogoBox w={p.logoEmpresaW} h={p.logoH} label="LOGO EMPRESA" />
        </div>
        <div style={{ borderBottom: `1px solid ${C.borde}`, margin: '10px 0 8px' }} />
        <div style={{ fontSize: p.datosPx, color: C.ink, fontWeight: 600 }}>Industrias Ejemplo S.A. · CUIT 30-98765432-1</div>
        <div style={{ fontSize: p.datosPx - 1, color: C.gris }}>Establecimiento: Planta Norte — Depósito B</div>
        <div style={{ fontSize: p.datosPx - 1, color: C.gris }}>Domicilio: Av. Industrial 4500 (S2002) · Rosario, Santa Fe</div>
        <div style={{ marginTop: 10, background: '#F2F8F2', borderLeft: `3px solid ${C.verde}`, padding: '6px 10px' }}>
          <div style={{ fontSize: p.tituloPx, fontWeight: 700, color: C.verdeOscuro }}>Reporte de Inspección de Seguridad</div>
          <div style={{ fontSize: p.datosPx - 2, color: C.gris }}>Res. SRT 48/2025</div>
        </div>
      </div>

      {/* Contenido (flex-1: empuja el footer abajo, nunca se superpone) */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, paddingTop: 12 }}>{children}</div>

      {/* Footer */}
      <div style={{ position: 'relative', zIndex: 1, borderTop: `1px solid ${C.borde}`, paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoBox w={70} h={28} label="Firma" />
          <div>
            <div style={{ fontSize: p.captionPx + 1, fontWeight: 600, color: C.ink }}>Ing. Juan Pérez</div>
            <div style={{ fontSize: p.captionPx, color: C.gris }}>Mat. COPIME 12345 · Emitido 15/06/2026</div>
          </div>
        </div>
        <div style={{ fontSize: p.captionPx, color: C.gris }}>Pág. 1 de 2</div>
      </div>
    </div>
  )
}

export default function PdfLabPage() {
  const [p, setP] = useState<Params>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const sheets = useRef<(HTMLDivElement | null)[]>([])

  if (process.env.NODE_ENV === 'production') {
    return <div style={{ padding: 24 }}>Solo disponible en desarrollo.</div>
  }

  const set = (k: keyof Params) => (v: number) => setP((s) => ({ ...s, [k]: v }))

  async function descargar() {
    setBusy(true)
    try {
      const { descargarProtocoloPdf } = await import('@/lib/pdf/protocolo-pdf')
      const hojas = sheets.current.filter((x): x is HTMLDivElement => !!x)
      await descargarProtocoloPdf({ hojas, escala: 2 }, 'reporte-demo.pdf')
    } catch (e) {
      alert('Error generando el PDF: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  const groups: { titulo: string; items: { k: keyof Params; label: string; min: number; max: number; step: number }[] }[] = [
    { titulo: 'Márgenes (mm)', items: [
      { k: 'marginTopMm', label: 'Superior', min: 4, max: 40, step: 1 },
      { k: 'marginBottomMm', label: 'Inferior', min: 4, max: 40, step: 1 },
      { k: 'marginLeftMm', label: 'Izquierdo', min: 4, max: 40, step: 1 },
      { k: 'marginRightMm', label: 'Derecho', min: 4, max: 40, step: 1 },
    ] },
    { titulo: 'Logos (px)', items: [
      { k: 'logoConsultoraW', label: 'Consultora ancho', min: 80, max: 260, step: 4 },
      { k: 'logoEmpresaW', label: 'Empresa ancho', min: 60, max: 220, step: 4 },
      { k: 'logoH', label: 'Alto de logos', min: 28, max: 90, step: 2 },
    ] },
    { titulo: 'Marca de agua', items: [
      { k: 'watermarkOpacityPct', label: 'Opacidad (%)', min: 1, max: 25, step: 1 },
      { k: 'watermarkW', label: 'Tamaño', min: 120, max: 520, step: 10 },
    ] },
    { titulo: 'Tipografía (px)', items: [
      { k: 'tituloPx', label: 'Título header', min: 12, max: 30, step: 1 },
      { k: 'datosPx', label: 'Datos header', min: 8, max: 18, step: 1 },
      { k: 'h2Px', label: 'Subtítulos', min: 12, max: 26, step: 1 },
      { k: 'bodyPx', label: 'Cuerpo', min: 9, max: 18, step: 1 },
      { k: 'captionPx', label: 'Pies/footer', min: 8, max: 15, step: 1 },
    ] },
    { titulo: 'Fotos (alto px)', items: [
      { k: 'fotoGrandeH', label: 'Foto grande', min: 120, max: 420, step: 10 },
      { k: 'fotoGridH', label: 'Fotos en grilla', min: 100, max: 280, step: 10 },
    ] },
  ]

  const h2 = { fontSize: p.h2Px, fontWeight: 700, color: C.verdeOscuro, borderBottom: `1px solid ${C.borde}`, paddingBottom: 3, margin: '14px 0 6px' } as const
  const body = { fontSize: p.bodyPx, color: C.ink, lineHeight: 1.5, marginBottom: 4 } as const

  const hallazgos: [string, string, string, string][] = [
    ['Ausencia de señalización de salidas de emergencia en sector B.', 'Grave', '7 días', C.rojo],
    ['Extintores con recarga vencida (3 unidades en depósito).', 'Moderado', '15 días', C.amarillo],
    ['Personal sin EPP completo en sector de carga y descarga.', 'Grave', 'Inmediato', C.rojo],
    ['Iluminación deficiente en pasillo lateral norte.', 'Leve', '30 días', C.gris],
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui', fontSize: 13 }}>
      {/* Controles */}
      <div style={{ width: 320, overflowY: 'auto', borderRight: '1px solid #ddd', padding: 16, background: '#fafafa' }}>
        <strong style={{ fontSize: 15 }}>PDF Lab — molde (HTML)</strong>
        <div style={{ display: 'flex', gap: 8, margin: '10px 0 14px' }}>
          <button onClick={() => setP(DEFAULTS)} style={btn}>Reset</button>
          <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(p, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500) }} style={{ ...btn, background: '#eee' }}>{copied ? '¡Copiado!' : 'Copiar valores'}</button>
          <button onClick={descargar} disabled={busy} style={{ ...btn, background: C.verdeOscuro, color: '#fff', borderColor: C.verdeOscuro }}>{busy ? 'Generando…' : 'Descargar PDF'}</button>
        </div>
        {groups.map((g) => (
          <div key={g.titulo} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{g.titulo}</div>
            {g.items.map((it) => (
              <div key={String(it.k)} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{it.label}</span><span style={{ color: C.verdeOscuro }}>{p[it.k]}</span></div>
                <input type="range" min={it.min} max={it.max} step={it.step} value={p[it.k]} onChange={(e) => set(it.k)(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Preview: hojas A4 reales */}
      <div style={{ flex: 1, overflow: 'auto', background: '#525659', padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        {/* Hoja 1 */}
        <Sheet p={p} refCb={(el) => (sheets.current[0] = el)}>
          <div style={h2}>Resumen Ejecutivo</div>
          <div style={body}>Se realizó una inspección de seguridad e higiene en el establecimiento Planta Norte — Depósito B, en fecha 15/06/2026, conforme a la Res. SRT 48/2025. La auditoría abarcó almacenamiento, circulación y uso de EPP.</div>
          <div style={{ margin: '8px 0' }}><PhotoBox h={p.fotoGrandeH} label="FOTO — Vista general del área" /></div>
          <div style={{ ...body, fontSize: p.captionPx, color: C.gris, marginTop: -2 }}>Fig. 1 — Vista general del área de depósito</div>
          <div style={h2}>Hallazgos Principales</div>
          {hallazgos.map((hh, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 5, paddingBottom: 5, borderBottom: `1px solid ${C.borde}`, gap: 8 }}>
              <span style={{ width: 18, height: 18, borderRadius: 3, background: C.verdeOscuro, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: p.bodyPx, color: C.ink }}>{hh[0]}</span>
              <span style={{ width: 64, textAlign: 'center', fontSize: p.captionPx, fontWeight: 700, color: hh[3] }}>{hh[1]}</span>
              <span style={{ width: 60, textAlign: 'right', fontSize: p.captionPx, color: C.gris }}>{hh[2]}</span>
            </div>
          ))}
          <div style={{ marginTop: 18 }}>
            <LogoBox w={150} h={56} label="Firma del profesional" />
            <div style={{ borderTop: `1px solid ${C.ink}`, width: 180, marginTop: 4, paddingTop: 3 }}>
              <div style={{ fontSize: p.bodyPx, fontWeight: 700 }}>Ing. Juan Pérez</div>
              <div style={{ fontSize: p.captionPx, color: C.gris }}>Lic. en Higiene y Seguridad · Mat. COPIME 12345</div>
            </div>
          </div>
        </Sheet>

        {/* Hoja 2 */}
        <Sheet p={p} refCb={(el) => (sheets.current[1] = el)}>
          <div style={h2}>Registro Fotográfico</div>
          <div style={body}>Las siguientes imágenes documentan los desvíos identificados durante la inspección.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{ width: 'calc(50% - 5px)' }}>
                <PhotoBox h={p.fotoGridH} label={`FOTO ${n}`} />
                <div style={{ fontSize: p.captionPx, color: C.gris }}>Fig. {n + 1} — Evidencia {n}</div>
              </div>
            ))}
          </div>
        </Sheet>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = { flex: 1, padding: '6px 8px', fontSize: 11, cursor: 'pointer', border: '1px solid #ccc', borderRadius: 6, background: '#fff' }
