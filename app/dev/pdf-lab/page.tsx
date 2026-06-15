'use client'

/**
 * /dev/pdf-lab — Taller en vivo del molde de reportes (report-kit)
 *
 * Controles a la izquierda + preview del PDF a la derecha que se regenera al
 * instante. Sirve para ajustar márgenes, header, marca de agua, tipografía,
 * logos y fotos VIÉNDOLO, sin tocar código. Cuando los valores están bien,
 * se copian (botón "Copiar valores") y se congelan en el kit (tokens.ts).
 *
 * SOLO desarrollo. react-pdf se importa dinámico (no corre en SSR).
 * Uso:  npm run dev  →  http://localhost:3000/dev/pdf-lab
 */

import React, { useEffect, useRef, useState } from 'react'

const MM = 2.83465 // 1mm en pt

// ── Parámetros ajustables (defaults = molde actual, reserva header alta para
//    arrancar SIN superposición) ──
const DEFAULTS = {
  marginTopMm: 26,
  marginBottomMm: 20,
  marginLeftMm: 18,
  marginRightMm: 18,
  headerReservePt: 150, // espacio reservado arriba para que el contenido no pise el header
  footerReservePt: 62, // espacio reservado abajo para el footer
  logoConsultoraW: 130,
  logoConsultoraH: 40,
  logoEmpresaW: 110,
  logoEmpresaH: 36,
  watermarkOpacityPct: 5,
  watermarkW: 150,
  tituloPt: 13,
  datosPt: 9,
  h2Pt: 14,
  bodyPt: 10,
  captionPt: 8.5,
  fotoGrandeH: 180,
  fotoGridH: 130,
}

type Params = typeof DEFAULTS

const COLORS = {
  verde: '#4CAF50', verdeOscuro: '#2E7D33', ink: '#333333', gris: '#888888',
  borde: '#E4E8E4', blanco: '#FFFFFF', amarillo: '#FFDE41', rojo: '#E53935',
}
const LOGO_CONSULTORA =
  'https://lslzhgmoaxgkcjeweqaz.supabase.co/storage/v1/object/public/consultora/9505c761-ddd7-4ea1-94c1-6ab132c4b31a/consultora/9505c761-ddd7-4ea1-94c1-6ab132c4b31a/logo.png'
const LOGO_EMPRESA = 'https://placehold.co/200x80/2E7D33/FFFFFF/png?text=EMPRESA'
const FIRMA = 'https://placehold.co/220x90/333333/FFFFFF/png?text=Firma'
const FOTO = (txt: string) => `https://placehold.co/800x600/E4E8E4/888888/png?text=${txt}`

let fontsRegistered = false

// Construye el Document de react-pdf con los parámetros actuales.
// RP = módulo @react-pdf/renderer (cargado dinámico).
function buildDoc(RP: any, p: Params) {
  const { Document, Page, View, Text, Image, Svg, Path } = RP
  const h = React.createElement
  const C = COLORS
  const M = {
    top: p.marginTopMm * MM,
    bottom: p.marginBottomMm * MM,
    left: p.marginLeftMm * MM,
    right: p.marginRightMm * MM,
  }
  const CONTENT_W = 595.28 - M.left - M.right
  const t = (txt: string, style: any) => h(Text, { style }, txt)

  const Watermark = () =>
    h(View, { fixed: true, style: { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center', opacity: p.watermarkOpacityPct / 100 } }, [
      h(Svg, { key: 's', width: p.watermarkW, height: p.watermarkW * 0.83, viewBox: '0 0 240 200' }, [
        h(Path, { key: 'a', d: 'M147 24 L46 188 L147 188 Z', fill: C.ink }),
        h(Path, { key: 'b', d: 'M153 24 L254 188 L153 188 Z', fill: 'none', stroke: C.ink, strokeWidth: 6 }),
      ]),
      h(Text, { key: 'w', style: { fontFamily: 'Montserrat', fontWeight: 700, fontSize: p.watermarkW * 0.15, color: C.ink, marginTop: 6 } }, 'SIGMETRÍA'),
    ])

  const Header = () =>
    h(View, { fixed: true, style: { position: 'absolute', top: 24, left: M.left, right: M.right } }, [
      h(View, { key: 'lg', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } }, [
        h(View, { key: 'l', style: { width: p.logoConsultoraW, height: p.logoConsultoraH } }, h(Image, { src: LOGO_CONSULTORA, style: { width: '100%', height: '100%', objectFit: 'contain' } })),
        h(View, { key: 'r', style: { width: p.logoEmpresaW, height: p.logoEmpresaH } }, h(Image, { src: LOGO_EMPRESA, style: { width: '100%', height: '100%', objectFit: 'contain' } })),
      ]),
      h(View, { key: 'd', style: { borderBottomWidth: 0.5, borderBottomColor: C.borde, marginTop: 8, marginBottom: 6 } }),
      t('Industrias Ejemplo S.A. · CUIT 30-98765432-1', { fontFamily: 'OpenSans', fontSize: p.datosPt, color: C.ink }),
      t('Establecimiento: Planta Norte — Depósito B', { fontFamily: 'OpenSans', fontSize: p.datosPt - 0.5, color: C.gris }),
      t('Domicilio: Av. Industrial 4500 (S2002) · Rosario, Santa Fe', { fontFamily: 'OpenSans', fontSize: p.datosPt - 0.5, color: C.gris }),
      h(View, { key: 'tb', style: { marginTop: 8, backgroundColor: '#F2F8F2', borderLeftWidth: 3, borderLeftColor: C.verde, paddingVertical: 4, paddingHorizontal: 8 } }, [
        t('Reporte de Inspección de Seguridad', { fontFamily: 'Montserrat', fontWeight: 700, fontSize: p.tituloPt, color: C.verdeOscuro }),
        t('Res. SRT 48/2025', { fontFamily: 'OpenSans', fontSize: 8, color: C.gris }),
      ]),
    ])

  const Footer = () =>
    h(View, { fixed: true, style: { position: 'absolute', bottom: 22, left: M.left, right: M.right, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 0.5, borderTopColor: C.borde, paddingTop: 4 } }, [
      h(View, { key: 'f', style: { flexDirection: 'row', alignItems: 'center' } }, [
        h(Image, { key: 'fi', src: FIRMA, style: { width: 60, height: 24, objectFit: 'contain', marginRight: 6 } }),
        h(View, { key: 'fd' }, [
          t('Ing. Juan Pérez', { fontFamily: 'OpenSans', fontWeight: 600, fontSize: 8, color: C.ink }),
          t('Mat. COPIME 12345 · Emitido 15/06/2026', { fontFamily: 'OpenSans', fontSize: 7.5, color: C.gris }),
        ]),
      ]),
      h(Text, { key: 'pg', fixed: true, style: { fontFamily: 'OpenSans', fontSize: 8, color: C.gris }, render: ({ pageNumber, totalPages }: any) => `Pág. ${pageNumber} de ${totalPages}` }),
    ])

  const PhotoBox = (src: string, w: any, height: number, caption: string) =>
    h(View, { style: { marginBottom: 6 } }, [
      h(View, { key: 'b', style: { width: w, height, overflow: 'hidden', borderWidth: 1, borderColor: C.borde, borderRadius: 4 } }, h(Image, { src, style: { width: '100%', height: '100%', objectFit: 'cover' } })),
      caption ? t(caption, { fontFamily: 'OpenSans', fontSize: p.captionPt, color: C.gris, marginTop: 2 }) : null,
    ])

  const SectionTitle = (txt: string) => t(txt, { fontFamily: 'Montserrat', fontWeight: 700, fontSize: p.h2Pt, color: C.verdeOscuro, marginTop: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: C.borde, paddingBottom: 2 })
  const Body = (txt: string) => t(txt, { fontFamily: 'OpenSans', fontSize: p.bodyPt, color: C.ink, lineHeight: 1.5, marginBottom: 4 })

  const pageStyle = { paddingTop: p.headerReservePt, paddingBottom: p.footerReservePt, paddingLeft: M.left, paddingRight: M.right, fontFamily: 'OpenSans' }

  const hallazgos: [string, string, string, string][] = [
    ['Ausencia de señalización de salidas de emergencia en sector B.', 'Grave', '7 días', C.rojo],
    ['Extintores con recarga vencida (3 unidades en depósito).', 'Moderado', '15 días', C.amarillo],
    ['Personal sin EPP completo en sector de carga y descarga.', 'Grave', 'Inmediato', C.rojo],
    ['Iluminación deficiente en pasillo lateral norte.', 'Leve', '30 días', C.gris],
  ]

  return h(Document, { title: 'PDF Lab — Sigmetría' }, [
    h(Page, { key: 'p1', size: 'A4', style: pageStyle }, [
      Watermark(), Header(), Footer(),
      SectionTitle('Resumen Ejecutivo'),
      Body('Se realizó una inspección de seguridad e higiene en el establecimiento Planta Norte — Depósito B, en fecha 15/06/2026, conforme a la Res. SRT 48/2025. La auditoría abarcó almacenamiento, circulación y uso de EPP.'),
      h(View, { key: 'ph', style: { marginTop: 8, marginBottom: 8 } }, PhotoBox(FOTO('Vista+general'), CONTENT_W, p.fotoGrandeH, 'Fig. 1 — Vista general del área de depósito')),
      SectionTitle('Hallazgos Principales'),
      ...hallazgos.map((hh, i) => h(View, { key: 'h' + i, style: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: C.borde } }, [
        t(String(i + 1), { fontFamily: 'OpenSans', fontWeight: 600, fontSize: 8.5, color: C.blanco, backgroundColor: C.verdeOscuro, width: 14, height: 14, textAlign: 'center', marginRight: 6, borderRadius: 2 }),
        t(hh[0], { fontFamily: 'OpenSans', fontSize: p.bodyPt, color: C.ink, flex: 1 }),
        t(hh[1], { fontFamily: 'OpenSans', fontWeight: 600, fontSize: 8.5, color: hh[3], width: 55, textAlign: 'center' }),
        t(hh[2], { fontFamily: 'OpenSans', fontSize: 8.5, color: C.gris, width: 55, textAlign: 'right' }),
      ])),
      h(View, { key: 'close', style: { marginTop: 24 } }, [
        h(Image, { key: 'cf', src: FIRMA, style: { width: 130, height: 52, objectFit: 'contain' } }),
        h(View, { key: 'cl', style: { borderTopWidth: 0.5, borderTopColor: C.ink, width: 160, marginTop: 2, paddingTop: 2 } }, [
          t('Ing. Juan Pérez', { fontFamily: 'Montserrat', fontWeight: 700, fontSize: 10, color: C.ink }),
          t('Lic. en Higiene y Seguridad', { fontFamily: 'OpenSans', fontSize: 8.5, color: C.gris }),
          t('Mat. COPIME 12345', { fontFamily: 'OpenSans', fontSize: 8.5, color: C.gris }),
        ]),
      ]),
    ]),
    h(Page, { key: 'p2', size: 'A4', style: pageStyle }, [
      Watermark(), Header(), Footer(),
      SectionTitle('Registro Fotográfico'),
      Body('Las siguientes imágenes documentan los desvíos identificados durante la inspección.'),
      h(View, { key: 'grid', style: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 } },
        [1, 2, 3, 4].map((n) => h(View, { key: 'g' + n, style: { width: (CONTENT_W - 8) / 2 } }, PhotoBox(FOTO('Foto+' + n), '100%', p.fotoGridH, `Fig. ${n + 1} — Evidencia ${n}`)))),
    ]),
  ])
}

export default function PdfLabPage() {
  const [params, setParams] = useState<Params>(DEFAULTS)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const genId = useRef(0)
  const prevUrl = useRef<string | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const id = ++genId.current
    setBusy(true)
    const timer = setTimeout(async () => {
      try {
        const RP = await import('@react-pdf/renderer')
        if (!fontsRegistered) {
          const { Font } = RP
          Font.register({ family: 'Montserrat', fonts: [
            { src: '/fonts/Montserrat-Medium.woff', fontWeight: 500 },
            { src: '/fonts/Montserrat-Bold.woff', fontWeight: 700 },
          ] })
          Font.register({ family: 'OpenSans', fonts: [
            { src: '/fonts/OpenSans-Regular.woff', fontWeight: 400 },
            { src: '/fonts/OpenSans-SemiBold.woff', fontWeight: 600 },
          ] })
          Font.registerHyphenationCallback((w: string) => [w])
          fontsRegistered = true
        }
        const blob: Blob = await Promise.race([
          RP.pdf(buildDoc(RP, params)).toBlob(),
          new Promise<Blob>((_, rej) => setTimeout(() => rej(new Error('Timeout 30s generando el PDF')), 30000)),
        ])
        if (id !== genId.current) return // llegó uno más nuevo
        const objectUrl = URL.createObjectURL(blob)
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
        prevUrl.current = objectUrl
        setUrl(objectUrl)
        setError(null)
      } catch (e) {
        if (id === genId.current) setError(e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e))
      } finally {
        if (id === genId.current) setBusy(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [params])

  if (process.env.NODE_ENV === 'production') {
    return <div style={{ padding: 24 }}>Solo disponible en desarrollo.</div>
  }

  const set = (k: keyof Params) => (v: number) => setParams((p) => ({ ...p, [k]: v }))

  const groups: { titulo: string; items: { k: keyof Params; label: string; min: number; max: number; step: number }[] }[] = [
    { titulo: 'Márgenes (mm)', items: [
      { k: 'marginTopMm', label: 'Superior', min: 5, max: 50, step: 1 },
      { k: 'marginBottomMm', label: 'Inferior', min: 5, max: 50, step: 1 },
      { k: 'marginLeftMm', label: 'Izquierdo', min: 5, max: 40, step: 1 },
      { k: 'marginRightMm', label: 'Derecho', min: 5, max: 40, step: 1 },
    ] },
    { titulo: 'Reservas (pt) — suben/bajan dónde empieza/termina el contenido', items: [
      { k: 'headerReservePt', label: 'Reserva header (arriba)', min: 60, max: 220, step: 2 },
      { k: 'footerReservePt', label: 'Reserva footer (abajo)', min: 30, max: 120, step: 2 },
    ] },
    { titulo: 'Logos (pt)', items: [
      { k: 'logoConsultoraW', label: 'Logo consultora ancho', min: 60, max: 220, step: 2 },
      { k: 'logoConsultoraH', label: 'Logo consultora alto', min: 20, max: 70, step: 1 },
      { k: 'logoEmpresaW', label: 'Logo empresa ancho', min: 50, max: 180, step: 2 },
      { k: 'logoEmpresaH', label: 'Logo empresa alto', min: 20, max: 70, step: 1 },
    ] },
    { titulo: 'Marca de agua', items: [
      { k: 'watermarkOpacityPct', label: 'Opacidad (%)', min: 1, max: 25, step: 1 },
      { k: 'watermarkW', label: 'Tamaño (ancho pt)', min: 60, max: 320, step: 5 },
    ] },
    { titulo: 'Tipografía (pt)', items: [
      { k: 'tituloPt', label: 'Título header', min: 9, max: 22, step: 0.5 },
      { k: 'datosPt', label: 'Datos header', min: 6, max: 13, step: 0.5 },
      { k: 'h2Pt', label: 'Subtítulos', min: 9, max: 20, step: 0.5 },
      { k: 'bodyPt', label: 'Cuerpo', min: 7, max: 14, step: 0.5 },
      { k: 'captionPt', label: 'Pies de foto', min: 6, max: 11, step: 0.5 },
    ] },
    { titulo: 'Fotos (alto pt)', items: [
      { k: 'fotoGrandeH', label: 'Foto grande', min: 100, max: 320, step: 5 },
      { k: 'fotoGridH', label: 'Fotos en grilla', min: 80, max: 220, step: 5 },
    ] },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui', fontSize: 13 }}>
      {/* Panel de controles */}
      <div style={{ width: 340, overflowY: 'auto', borderRight: '1px solid #ddd', padding: 16, background: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <strong style={{ fontSize: 15 }}>PDF Lab — molde</strong>
          {busy && <span style={{ color: '#2E7D33', fontSize: 11 }}>↻ generando…</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setParams(DEFAULTS)} style={btn}>Reset</button>
          <button
            onClick={() => { navigator.clipboard.writeText(JSON.stringify(params, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            style={{ ...btn, background: '#2E7D33', color: '#fff', borderColor: '#2E7D33' }}
          >{copied ? '¡Copiado!' : 'Copiar valores'}</button>
        </div>

        {groups.map((g) => (
          <div key={g.titulo} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{g.titulo}</div>
            {g.items.map((it) => (
              <div key={String(it.k)} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{it.label}</span>
                  <span style={{ color: '#2E7D33', fontVariantNumeric: 'tabular-nums' }}>{params[it.k]}</span>
                </div>
                <input
                  type="range" min={it.min} max={it.max} step={it.step} value={params[it.k]}
                  onChange={(e) => set(it.k)(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Preview */}
      <div style={{ flex: 1, background: '#525659', position: 'relative' }}>
        {error ? (
          <pre style={{ padding: 24, color: '#fff', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>{error}</pre>
        ) : url ? (
          <iframe src={url} title="PDF Lab" style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : (
          <div style={{ padding: 24, color: '#fff' }}>Generando PDF…</div>
        )}
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  flex: 1, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
  border: '1px solid #ccc', borderRadius: 6, background: '#fff',
}
