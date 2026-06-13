'use client'

/**
 * Reporte de Observaciones de Campo — emisión por período.
 *
 * Botón "Emitir reporte de observaciones de campo" → modal con selector de período
 * (diario / semanal / mensual). Al generar, consolida las observaciones del
 * establecimiento cuya recorrida cae en el período (server action), arma la vista
 * previa y produce un PDF (html2canvas + jsPDF, mismo enfoque que el ejecutor de
 * reporte fotográfico). Permite descargar, compartir el link y enviar por email.
 *
 * NO toca la carga ni el marcado de observaciones: solo consume gestiones_observaciones.
 */

import { forwardRef, useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { signBucketPaths } from '@/lib/storage/sign-client'
import {
  obtenerDatosReporteObservacionesCampo,
  emitirReporteObservacionesCampo,
  type ReporteObsCampoData,
  type ReporteObsCampoItem,
} from '@/lib/actions/reporte-observaciones-campo'
import {
  type ModoPeriodo,
  type SemanaDelMes,
  rangoDiario,
  rangoMensual,
  rangoSemanal,
  semanasDelMes,
  labelPeriodo,
  fmtFechaCorta,
} from '@/lib/reportes/periodo-campo'
import {
  FileText, CalendarDays, Download, Copy, Send, CheckCircle, Loader2, Mail,
} from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Color del punto por nivel de severidad (coincide con observaciones_categorias.color).
const NIVEL_COLOR: Record<number, string> = {
  1: '#FFFFFF', // Oportunidades de mejora
  2: '#FACC15', // Acción inmediata media
  3: '#EA580C', // Acción inmediata alta
  4: '#DC2626', // Acción inmediata crítica
}
const ESTADO_COLOR: Record<string, string> = {
  Planificado: '#0369a1',
  Vencido: '#dc2626',
  Cerrado: '#15803d',
}

/** Convierte una URL (signed) a data-URI base64 para que html2canvas no choque con CORS. */
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Genera el PDF (multipágina A4) del nodo y devuelve un Blob BINARIO.
 *
 * Devolvemos Blob (no data-URI base64) para enviarlo crudo al server action: el
 * base64 infla ~33% y un reporte MENSUAL con muchas fotos reventaría el
 * serverActions.bodySizeLimit. scale 1.5 + JPEG 0.82 mantiene el documento
 * legible pero acota el tamaño (el texto de un reporte no necesita 2x retina).
 */
async function generarPdfBlob(node: HTMLElement): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')
  const canvas = await html2canvas(node, { scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/jpeg', 0.82)
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const pdfH = (canvas.height * pdfW) / canvas.width
  let heightLeft = pdfH
  let position = 0
  pdf.addImage(imgData, 'JPEG', 0, position, pdfW, pdfH)
  heightLeft -= pageH
  while (heightLeft > 0) {
    position = heightLeft - pdfH
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, position, pdfW, pdfH)
    heightLeft -= pageH
  }
  return pdf.output('blob')
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function ReporteObservacionesCampoButton({ establecimientoId }: { establecimientoId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-primary text-white hover:opacity-90 transition-opacity"
      >
        <FileText size={14} />
        Emitir reporte de observaciones
      </button>
      {open && <ReporteObservacionesCampoModal establecimientoId={establecimientoId} onClose={() => setOpen(false)} />}
    </>
  )
}

function ReporteObservacionesCampoModal({
  establecimientoId,
  onClose,
}: {
  establecimientoId: string
  onClose: () => void
}) {
  // Período se inicializa en efecto (evita mismatch SSR con new Date()).
  const [modo, setModo] = useState<ModoPeriodo>('mensual')
  const [year, setYear] = useState<number | null>(null)
  const [month0, setMonth0] = useState(0)
  const [fechaDiaria, setFechaDiaria] = useState('')
  const [semanaNumero, setSemanaNumero] = useState(1)

  const [step, setStep] = useState<'config' | 'result'>('config')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ReporteObsCampoData | null>(null)
  const [periodoLabel, setPeriodoLabel] = useState('')
  const [fotoUrls, setFotoUrls] = useState<Map<string, string>>(new Map())

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [destinatarios, setDestinatarios] = useState('')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [emailOk, setEmailOk] = useState(false)

  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth0(now.getMonth())
    setFechaDiaria(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
  }, [])

  const semanas: SemanaDelMes[] = year != null ? semanasDelMes(year, month0) : []
  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-primary/30'

  function resolverRango(): { desde: string; hasta: string; label: string } | null {
    if (year == null) return null
    if (modo === 'diario') {
      if (!fechaDiaria) return null
      const r = rangoDiario(fechaDiaria)
      return { ...r, label: labelPeriodo('diario', r) }
    }
    if (modo === 'mensual') {
      const r = rangoMensual(year, month0)
      return { ...r, label: labelPeriodo('mensual', r, { month0, year }) }
    }
    // semanal
    const r = rangoSemanal(year, month0, semanaNumero)
    if (!r) return null
    const sem = semanas.find(s => s.numero === semanaNumero)
    return { ...r, label: labelPeriodo('semanal', r, { month0, year, semanaLabel: sem?.label }) }
  }

  async function handleGenerar() {
    const rango = resolverRango()
    if (!rango) { setError('Elegí un período válido.'); return }
    setError(null)
    setLoading(true)
    setPdfBlob(null)
    setPdfSignedUrl(null)
    setEmailOk(false)
    try {
      const res = await obtenerDatosReporteObservacionesCampo(establecimientoId, rango.desde, rango.hasta)
      if (!res.success) { setError(res.error); setLoading(false); return }
      const d = res.data

      // Firmamos y bajamos a data-URI todas las fotos (foto de obs + evidencia de cierre).
      const paths = new Set<string>()
      for (const it of d.items) {
        if (it.fotoPath) paths.add(it.fotoPath)
        if (it.evidenciaCierrePath) paths.add(it.evidenciaCierrePath)
      }
      const urlMap = new Map<string, string>()
      if (paths.size > 0) {
        const signed = await signBucketPaths('documentos', Array.from(paths))
        await Promise.all(
          Array.from(signed.entries()).map(async ([path, url]) => {
            if (!url) return
            const dataUrl = await urlToDataUrl(url)
            if (dataUrl) urlMap.set(path, dataUrl)
          }),
        )
      }

      setData(d)
      setPeriodoLabel(rango.label)
      setFotoUrls(urlMap)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado al generar el reporte')
    } finally {
      setLoading(false)
    }
  }

  const filename = data
    ? `reporte-observaciones-${slug(data.encabezado.establecimiento)}-${slug(periodoLabel)}.pdf`
    : 'reporte-observaciones.pdf'

  /** Genera el PDF del nodo una sola vez y lo cachea. */
  async function asegurarPdf(): Promise<Blob | null> {
    if (pdfBlob) return pdfBlob
    const node = reportRef.current
    if (!node) return null
    const blob = await generarPdfBlob(node)
    setPdfBlob(blob)
    return blob
  }

  async function handleDescargar() {
    const blob = await asegurarPdf()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function subirYObtenerLink(conEmail: boolean): Promise<void> {
    if (!data) return
    const blob = await asegurarPdf()
    if (!blob) { setError('No se pudo generar el PDF.'); return }
    setEnviando(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('establecimiento_id', establecimientoId)
      fd.set('pdf', blob, filename)
      fd.set('filename', filename)
      fd.set('periodo_label', periodoLabel)
      fd.set('cliente', data.encabezado.cliente)
      fd.set('establecimiento', data.encabezado.establecimiento)
      if (conEmail) {
        fd.set('destinatarios', destinatarios)
        fd.set('comentario', comentario)
      }
      const res = await emitirReporteObservacionesCampo(fd)
      if (!res.success) { setError(res.error); setEnviando(false); return }
      setPdfSignedUrl(res.data.pdfSignedUrl)
      if (conEmail && res.data.emailEnviado) setEmailOk(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al emitir el reporte')
    } finally {
      setEnviando(false)
    }
  }

  function handleCopiarLink() {
    if (!pdfSignedUrl) return
    navigator.clipboard.writeText(pdfSignedUrl).then(() => {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    }).catch(() => {})
  }

  function volverAConfig() {
    setStep('config')
    setData(null)
    setPdfBlob(null)
    setPdfSignedUrl(null)
    setEmailOk(false)
    setError(null)
  }

  return (
    <Modal open title="Reporte de observaciones" onClose={onClose} size="full">
      <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        {/* ── CONFIG: selector de período ─────────────────────────── */}
        {step === 'config' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Tipo de reporte</label>
              <div className="flex flex-wrap gap-2">
                {(['diario', 'semanal', 'mensual'] as ModoPeriodo[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModo(m)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      modo === m
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-surface-base text-text-secondary border-border-default hover:bg-surface-elevated'
                    }`}
                  >
                    <CalendarDays size={14} />
                    {m === 'diario' ? 'Diario' : m === 'semanal' ? 'Semanal' : 'Mensual'}
                  </button>
                ))}
              </div>
            </div>

            {modo === 'diario' && (
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Fecha</label>
                <input type="date" value={fechaDiaria} onChange={e => setFechaDiaria(e.target.value)} className={inputCls} />
              </div>
            )}

            {(modo === 'semanal' || modo === 'mensual') && year != null && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-1">Año</label>
                  <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
                    <option value={year + 1}>{year + 1}</option>
                    <option value={year}>{year}</option>
                    <option value={year - 1}>{year - 1}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-1">Mes</label>
                  <select
                    value={month0}
                    onChange={e => { setMonth0(Number(e.target.value)); setSemanaNumero(1) }}
                    className={inputCls}
                  >
                    {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
                {modo === 'semanal' && (
                  <div>
                    <label className="text-sm font-medium text-text-secondary block mb-1">Semana</label>
                    <select value={semanaNumero} onChange={e => setSemanaNumero(Number(e.target.value))} className={inputCls}>
                      {semanas.map(s => <option key={s.numero} value={s.numero}>{s.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button type="button" onClick={handleGenerar} disabled={loading}>
                {loading ? <><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Generando…</> : 'Generar reporte'}
              </Button>
            </div>
          </div>
        )}

        {/* ── RESULT: preview + acciones ──────────────────────────── */}
        {step === 'result' && data && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={volverAConfig} className="text-xs text-brand-primary hover:underline">
                ← Cambiar período
              </button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleDescargar} disabled={enviando}>
                  <Download size={14} className="inline mr-1.5" /> Descargar PDF
                </Button>
                <Button type="button" variant="secondary" onClick={() => subirYObtenerLink(false)} disabled={enviando}>
                  {enviando && !destinatarios ? <Loader2 size={14} className="inline mr-1.5 animate-spin" /> : <Copy size={14} className="inline mr-1.5" />}
                  Generar link
                </Button>
              </div>
            </div>

            {pdfSignedUrl && (
              <div className="bg-surface-elevated border border-border-subtle rounded-lg p-3 flex flex-wrap items-center gap-2">
                <a href={pdfSignedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-primary hover:underline break-all flex-1 min-w-0">
                  {pdfSignedUrl}
                </a>
                <button type="button" onClick={handleCopiarLink} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border-default text-text-secondary hover:bg-surface-base">
                  <Copy size={12} /> {linkCopiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}

            {/* Envío por email */}
            <div className="border border-border-subtle rounded-lg p-3 space-y-2">
              <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                <Mail size={14} /> Enviar por email
              </label>
              <input
                type="text"
                value={destinatarios}
                onChange={e => setDestinatarios(e.target.value)}
                placeholder="Destinatarios separados por coma (cliente, dirección, responsable…)"
                className={inputCls}
              />
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                rows={2}
                placeholder="Comentario para el cuerpo del email (opcional)…"
                className={`${inputCls} resize-none`}
              />
              <div className="flex items-center justify-between">
                {emailOk
                  ? <span className="text-xs text-success inline-flex items-center gap-1"><CheckCircle size={14} /> Email enviado</span>
                  : <span className="text-xs text-text-tertiary">El PDF se adjunta automáticamente.</span>}
                <Button type="button" onClick={() => subirYObtenerLink(true)} disabled={enviando || !destinatarios.trim()}>
                  {enviando && destinatarios ? <><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Enviando…</> : <><Send size={14} className="inline mr-1.5" /> Enviar</>}
                </Button>
              </div>
            </div>

            {/* Vista previa = nodo del PDF */}
            <div className="border border-border-subtle rounded-lg overflow-hidden">
              <ReporteDocumento ref={reportRef} data={data} periodoLabel={periodoLabel} fotoUrls={fotoUrls} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Documento del reporte (se renderiza a PDF) ─────────────────────────────
const ReporteDocumento = forwardRef<HTMLDivElement, {
  data: ReporteObsCampoData
  periodoLabel: string
  fotoUrls: Map<string, string>
}>(function ReporteDocumento({ data, periodoLabel, fotoUrls }, ref) {
  const { encabezado, items, resumen } = data

  // Agrupar el detalle por tipo (nivel desc: crítica → oportunidad).
  const grupos = new Map<number, ReporteObsCampoItem[]>()
  for (const it of items) {
    const nivel = it.categoriaNivel ?? 0
    if (!grupos.has(nivel)) grupos.set(nivel, [])
    grupos.get(nivel)!.push(it)
  }
  const nivelesOrdenados = Array.from(grupos.keys()).sort((a, b) => b - a)

  return (
    <div ref={ref} className="bg-white text-gray-900" style={{ padding: '10mm', fontSize: '12px', lineHeight: 1.5 }}>
      {/* Encabezado */}
      <div style={{ borderBottom: '2px solid #111827', paddingBottom: '10px', marginBottom: '14px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Reporte de Observaciones</h1>
        <table style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}>
          <tbody>
            <tr>
              <td style={{ color: '#6b7280', paddingRight: '8px' }}>Cliente:</td>
              <td style={{ fontWeight: 600 }}>{encabezado.cliente}</td>
              <td style={{ color: '#6b7280', paddingRight: '8px' }}>Período:</td>
              <td style={{ fontWeight: 600 }}>{periodoLabel}</td>
            </tr>
            <tr>
              <td style={{ color: '#6b7280', paddingRight: '8px' }}>Establecimiento:</td>
              <td style={{ fontWeight: 600 }}>{encabezado.establecimiento}</td>
              <td style={{ color: '#6b7280', paddingRight: '8px' }}>Profesional:</td>
              <td style={{ fontWeight: 600 }}>{encabezado.profesional}</td>
            </tr>
            <tr>
              <td style={{ color: '#6b7280', paddingRight: '8px' }}>Emisión:</td>
              <td style={{ fontWeight: 600 }}>{encabezado.fechaEmision}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      {resumen.total === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
          Sin observaciones en el período.
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 6px' }}>Resumen</h2>
            <p style={{ margin: '0 0 8px' }}>Total de observaciones: <strong>{resumen.total}</strong></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
              <div>
                <p style={{ fontWeight: 600, margin: '0 0 4px', color: '#374151' }}>Por tipo</p>
                {resumen.porTipo.map(t => (
                  <div key={t.nivel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: NIVEL_COLOR[t.nivel] ?? '#d1d5db', border: '1px solid #9ca3af', display: 'inline-block' }} />
                    <span>{t.nombre}: <strong>{t.count}</strong></span>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontWeight: 600, margin: '0 0 4px', color: '#374151' }}>Por estado</p>
                {(['Vencido', 'Planificado', 'Cerrado'] as const).map(e => (
                  <div key={e} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ESTADO_COLOR[e], display: 'inline-block' }} />
                    <span>{e}: <strong>{resumen.porEstado[e]}</strong></span>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontWeight: 600, margin: '0 0 4px', color: '#374151' }}>Por responsable</p>
                {resumen.porResponsable.map(r => (
                  <div key={r.nombre}>{r.nombre}: <strong>{r.count}</strong></div>
                ))}
              </div>
            </div>
          </div>

          {/* Detalle agrupado por tipo */}
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px' }}>Detalle de observaciones</h2>
            {nivelesOrdenados.map(nivel => {
              const grupo = grupos.get(nivel)!
              const nombreTipo = grupo[0]?.categoriaNombre ?? `Nivel ${nivel}`
              return (
                <div key={nivel} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', marginBottom: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: NIVEL_COLOR[nivel] ?? '#d1d5db', border: '1px solid #9ca3af', display: 'inline-block' }} />
                    <strong>{nombreTipo}</strong>
                    <span style={{ color: '#6b7280' }}>({grupo.length})</span>
                  </div>
                  {grupo.map((it, idx) => (
                    <ObservacionBloque key={it.id} item={it} index={idx} fotoUrls={fotoUrls} />
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '8px', fontSize: '10px', color: '#9ca3af' }}>
        Generado por Sigmetría · Sistema de gestión de Higiene y Seguridad.
      </div>
    </div>
  )
})

function ObservacionBloque({
  item,
  index,
  fotoUrls,
}: {
  item: ReporteObsCampoItem
  index: number
  fotoUrls: Map<string, string>
}) {
  const foto = item.fotoPath ? fotoUrls.get(item.fotoPath) : null
  const fotoCierre = item.evidenciaCierrePath ? fotoUrls.get(item.evidenciaCierrePath) : null
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '6px', breakInside: 'avoid' }}>
      {foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="Observación" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d1d5db', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{index + 1}. {item.descripcion}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', color: '#374151', fontSize: '11px' }}>
          {item.clasificacionNombre && <span>Riesgo: <strong>{item.clasificacionNombre}</strong></span>}
          <span>Responsable: <strong>{item.responsable ?? 'Sin asignar'}</strong></span>
          <span>Plazo: <strong>{fmtFechaCorta(item.fechaPlazo)}</strong></span>
          {item.fechaEjecutada && <span>Recorrida: <strong>{fmtFechaCorta(item.fechaEjecutada)}</strong></span>}
          {item.sectorNombre && <span>Sector: <strong>{item.sectorNombre}</strong></span>}
          {item.puestoNombre && <span>Puesto: <strong>{item.puestoNombre}</strong></span>}
          <span style={{ color: ESTADO_COLOR[item.estado] }}>Estado: <strong>{item.estado}</strong></span>
        </div>
        {item.estado === 'Cerrado' && (
          <div style={{ marginTop: '4px', fontSize: '11px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>✓ Cerrada el {fmtFechaCorta(item.fechaCierre)}{item.responsableCierre ? ` por ${item.responsableCierre}` : ''}</span>
            {fotoCierre && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoCierre} alt="Evidencia de cierre" style={{ width: '60px', height: '45px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #86efac' }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
