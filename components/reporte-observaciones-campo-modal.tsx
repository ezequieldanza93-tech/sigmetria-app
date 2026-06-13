'use client'

/**
 * Reporte de Observaciones — emisión por período (diario / semanal / mensual),
 * a nivel ESTABLECIMIENTO o EMPRESA (consolidado de todos sus establecimientos).
 *
 * Antes de emitir permite FILTRAR por quién relevó y por responsable de cierre
 * (uno / varios / todos), para entregarle a cada responsable su lista de
 * subsanaciones. El PDF se arma por HOJAS A4 (generarProtocoloPdf): hoja 1 =
 * encabezado + resumen; hojas siguientes = 2 observaciones por página con FOTO
 * GRANDE. Permite descargar, compartir el link y enviar por email.
 *
 * NO toca la carga ni el marcado de observaciones: solo consume gestiones_observaciones.
 */

import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
import { signBucketPaths } from '@/lib/storage/sign-client'
import { generarProtocoloPdf } from '@/lib/pdf/protocolo-pdf'
import {
  obtenerDatosReporteObservacionesCampo,
  obtenerDatosReporteObservacionesEmpresa,
  emitirReporteObservacionesCampo,
} from '@/lib/actions/reporte-observaciones-campo'
import {
  construirResumenObservaciones,
  type ReporteObsCampoData,
  type ReporteObsCampoItem,
  type ReporteObsCampoResumen,
} from '@/lib/reportes/observaciones-campo-tipos'
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

type Nivel = 'establecimiento' | 'empresa'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Dimensiones de hoja A4 a 96dpi (mismas que usan los protocolos de medición).
const PAGE_W = 794
const PAGE_H = 1123

const NIVEL_COLOR: Record<number, string> = {
  1: '#FFFFFF', 2: '#FACC15', 3: '#EA580C', 4: '#DC2626',
}
const ESTADO_COLOR: Record<string, string> = {
  Planificado: '#0369a1', Vencido: '#dc2626', Cerrado: '#15803d',
}

const SIN_ASIGNAR = 'Sin asignar'

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

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── Botones públicos ───────────────────────────────────────────────────────
export function ReporteObservacionesCampoButton({ establecimientoId }: { establecimientoId: string }) {
  return <ReporteButtonBase nivel="establecimiento" id={establecimientoId} />
}

export function ReporteObservacionesEmpresaButton({ empresaId }: { empresaId: string }) {
  return <ReporteButtonBase nivel="empresa" id={empresaId} />
}

function ReporteButtonBase({ nivel, id }: { nivel: Nivel; id: string }) {
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
      {open && <ReporteModal nivel={nivel} id={id} onClose={() => setOpen(false)} />}
    </>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function ReporteModal({ nivel, id, onClose }: { nivel: Nivel; id: string; onClose: () => void }) {
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

  // Filtros pre-emisión (null = todos).
  const [relevadoSel, setRelevadoSel] = useState<Set<string> | null>(null)
  const [cierreSel, setCierreSel] = useState<Set<string> | null>(null)

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [destinatarios, setDestinatarios] = useState('')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [emailOk, setEmailOk] = useState(false)

  const hojasRef = useRef<HTMLDivElement>(null)

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
    setRelevadoSel(null)
    setCierreSel(null)
    try {
      const res = nivel === 'empresa'
        ? await obtenerDatosReporteObservacionesEmpresa(id, rango.desde, rango.hasta)
        : await obtenerDatosReporteObservacionesCampo(id, rango.desde, rango.hasta)
      if (!res.success) { setError(res.error); setLoading(false); return }
      const d = res.data

      // Firmamos y bajamos a data-URI las fotos (de obs + evidencia de cierre).
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

  // ── Opciones de filtro derivadas de los datos del período ──
  const relevadoOpciones = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    for (const it of data.items) s.add(it.relevadoPor ?? SIN_ASIGNAR)
    return Array.from(s).sort().map(v => ({ value: v, label: v }))
  }, [data])

  const cierreOpciones = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    for (const it of data.items) s.add(it.responsableCierre ?? SIN_ASIGNAR)
    return Array.from(s).sort().map(v => ({ value: v, label: v }))
  }, [data])

  const itemsFiltrados = useMemo(() => {
    if (!data) return []
    return data.items.filter(it => {
      const rel = it.relevadoPor ?? SIN_ASIGNAR
      const cie = it.responsableCierre ?? SIN_ASIGNAR
      if (relevadoSel && !relevadoSel.has(rel)) return false
      if (cierreSel && !cierreSel.has(cie)) return false
      return true
    })
  }, [data, relevadoSel, cierreSel])

  const resumenFiltrado: ReporteObsCampoResumen = useMemo(
    () => construirResumenObservaciones(itemsFiltrados),
    [itemsFiltrados],
  )

  const hojasDetalle = useMemo(() => chunk(itemsFiltrados, 2), [itemsFiltrados])

  function onFiltroChange(setter: (s: Set<string> | null) => void, next: Set<string>) {
    setter(next)
    setPdfBlob(null) // invalida el PDF cacheado: cambió el set de observaciones
  }

  const filename = data
    ? `reporte-observaciones-${slug(data.encabezado.cliente || data.encabezado.establecimiento)}-${slug(periodoLabel)}.pdf`
    : 'reporte-observaciones.pdf'

  async function asegurarPdf(): Promise<Blob | null> {
    if (pdfBlob) return pdfBlob
    const cont = hojasRef.current
    if (!cont) return null
    const hojas = Array.from(cont.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    )
    if (hojas.length === 0) return null
    // escala 1.5: nitidez suficiente para fotos grandes sin inflar el PDF.
    const pdf = await generarProtocoloPdf({ hojas, escala: 1.5 })
    const blob = pdf.output('blob')
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
    // Diferimos el revoke: revocar en el mismo tick que click() aborta la descarga
    // en Firefox / algunos Chromium (baja un archivo de 0 bytes).
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function subirYObtenerLink(conEmail: boolean): Promise<void> {
    if (!data) return
    const blob = await asegurarPdf()
    if (!blob) { setError('No se pudo generar el PDF.'); return }
    // Guard de tamaño: el server action tiene bodySizeLimit (25mb). Un consolidado
    // de empresa con muchas fotos puede superarlo → avisamos accionable en vez de
    // dejar que falle con un error opaco de red. La descarga local no pasa por acá.
    const MAX_BYTES = 23 * 1024 * 1024
    if (blob.size > MAX_BYTES) {
      setError('El reporte es demasiado pesado para compartir/enviar (supera el límite del servidor). Acotá el período o filtrá por responsable de cierre. La descarga local (botón "Descargar PDF") sigue disponible.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const fd = new FormData()
      if (nivel === 'empresa') fd.set('empresa_id', id)
      else fd.set('establecimiento_id', id)
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

  const tituloModal = nivel === 'empresa'
    ? 'Reporte de observaciones (empresa)'
    : 'Reporte de observaciones'

  return (
    <Modal open title={tituloModal} onClose={onClose} size="full">
      <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        {/* ── CONFIG ───────────────────────────────────────────── */}
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

        {/* ── RESULT ───────────────────────────────────────────── */}
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
                  <Copy size={14} className="inline mr-1.5" /> Generar link
                </Button>
              </div>
            </div>

            {/* Filtros pre-emisión */}
            <div className="flex flex-wrap items-center gap-2 border border-border-subtle rounded-lg p-3">
              <span className="text-xs font-medium text-text-secondary">Filtrar:</span>
              <MultiSelectFilter
                label="Relevado por"
                options={relevadoOpciones}
                selected={relevadoSel ?? new Set(relevadoOpciones.map(o => o.value))}
                onChange={s => onFiltroChange(setRelevadoSel, s)}
              />
              <MultiSelectFilter
                label="Resp. de cierre"
                options={cierreOpciones}
                selected={cierreSel ?? new Set(cierreOpciones.map(o => o.value))}
                onChange={s => onFiltroChange(setCierreSel, s)}
              />
              <span className="text-xs text-text-tertiary ml-auto">
                {itemsFiltrados.length} de {data.items.length} observaciones
              </span>
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
                  {enviando ? <><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Enviando…</> : <><Send size={14} className="inline mr-1.5" /> Enviar</>}
                </Button>
              </div>
            </div>

            {/* Vista previa = hojas del PDF (WYSIWYG). Cada hijo directo = 1 página A4. */}
            <div className="overflow-auto border border-border-subtle rounded-lg bg-gray-100 p-4">
              <div ref={hojasRef} className="space-y-4 mx-auto" style={{ width: PAGE_W }}>
                <HojaResumen data={data} resumen={resumenFiltrado} periodoLabel={periodoLabel} />
                {hojasDetalle.map((par, i) => (
                  <HojaDetalle key={i} items={par} fotoUrls={fotoUrls} indexBase={i * 2} nivel={nivel} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Hojas A4 ──────────────────────────────────────────────────────────────
const hojaBaseStyle: CSSProperties = {
  width: PAGE_W,
  minHeight: PAGE_H,
  backgroundColor: '#ffffff',
  color: '#111827',
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: 13,
  lineHeight: 1.5,
  padding: 44,
  boxSizing: 'border-box',
}

function HojaResumen({
  data,
  resumen,
  periodoLabel,
}: {
  data: ReporteObsCampoData
  resumen: ReporteObsCampoResumen
  periodoLabel: string
}) {
  const { encabezado } = data
  return (
    <div style={hojaBaseStyle}>
      <div style={{ borderBottom: '3px solid #111827', paddingBottom: 12, marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Reporte de Observaciones</h1>
        <table style={{ width: '100%', marginTop: 10, fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ color: '#6b7280', paddingRight: 8, width: 110 }}>Cliente:</td>
              <td style={{ fontWeight: 600 }}>{encabezado.cliente}</td>
              <td style={{ color: '#6b7280', paddingRight: 8, width: 110 }}>Período:</td>
              <td style={{ fontWeight: 600 }}>{periodoLabel}</td>
            </tr>
            <tr>
              <td style={{ color: '#6b7280', paddingRight: 8 }}>Establecimiento:</td>
              <td style={{ fontWeight: 600 }}>{encabezado.establecimiento}</td>
              <td style={{ color: '#6b7280', paddingRight: 8 }}>Profesional:</td>
              <td style={{ fontWeight: 600 }}>{encabezado.profesional}</td>
            </tr>
            <tr>
              <td style={{ color: '#6b7280', paddingRight: 8 }}>Emisión:</td>
              <td style={{ fontWeight: 600 }}>{encabezado.fechaEmision}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      {resumen.total === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280', fontSize: 15 }}>
          Sin observaciones en el período.
        </div>
      ) : (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Resumen</h2>
          <p style={{ margin: '0 0 12px' }}>Total de observaciones: <strong>{resumen.total}</strong></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 36 }}>
            <div>
              <p style={{ fontWeight: 600, margin: '0 0 6px', color: '#374151' }}>Por tipo</p>
              {resumen.porTipo.map(t => (
                <div key={t.nivel} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: NIVEL_COLOR[t.nivel] ?? '#d1d5db', border: '1px solid #9ca3af', display: 'inline-block' }} />
                  <span>{t.nombre}: <strong>{t.count}</strong></span>
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontWeight: 600, margin: '0 0 6px', color: '#374151' }}>Por estado</p>
              {(['Vencido', 'Planificado', 'Cerrado'] as const).map(e => (
                <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: ESTADO_COLOR[e], display: 'inline-block' }} />
                  <span>{e}: <strong>{resumen.porEstado[e]}</strong></span>
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontWeight: 600, margin: '0 0 6px', color: '#374151' }}>Por responsable</p>
              {resumen.porResponsable.map(r => (
                <div key={r.nombre} style={{ marginBottom: 2 }}>{r.nombre}: <strong>{r.count}</strong></div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function HojaDetalle({
  items,
  fotoUrls,
  indexBase,
  nivel,
}: {
  items: ReporteObsCampoItem[]
  fotoUrls: Map<string, string>
  indexBase: number
  nivel: Nivel
}) {
  return (
    <div style={{ ...hojaBaseStyle, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {items.map((it, i) => (
        <ObsBloqueGrande key={it.id} item={it} numero={indexBase + i + 1} fotoUrls={fotoUrls} nivel={nivel} />
      ))}
    </div>
  )
}

function Campo({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <span style={{ color: '#6b7280' }}>{label}: </span>
      <strong>{value && value.trim() ? value : '—'}</strong>
    </div>
  )
}

function ObsBloqueGrande({
  item,
  numero,
  fotoUrls,
  nivel,
}: {
  item: ReporteObsCampoItem
  numero: number
  fotoUrls: Map<string, string>
  nivel: Nivel
}) {
  const foto = item.fotoPath ? fotoUrls.get(item.fotoPath) : null
  const fotoCierre = item.evidenciaCierrePath ? fotoUrls.get(item.evidenciaCierrePath) : null
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Cabecera de la observación: número + tipo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f3f4f6' }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: NIVEL_COLOR[item.categoriaNivel ?? 0] ?? '#d1d5db', border: '1px solid #9ca3af', display: 'inline-block' }} />
        <strong style={{ fontSize: 14 }}>#{numero} · {item.categoriaNombre ?? 'Sin tipo'}</strong>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: ESTADO_COLOR[item.estado] }}>{item.estado}</span>
      </div>

      <div style={{ display: 'flex', gap: 14, padding: 12 }}>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt={`Observación ${numero}`}
            style={{ width: 320, height: 300, objectFit: 'cover', borderRadius: 6, border: '1px solid #d1d5db', flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13.5 }}>
            <span style={{ color: '#6b7280' }}>Comentario: </span>{item.descripcion}
          </p>
          {nivel === 'empresa' && <Campo label="Establecimiento" value={item.establecimientoNombre} />}
          <Campo label="Gestión" value={item.gestionNombre} />
          <Campo label="Tipo de riesgo" value={item.clasificacionNombre} />
          <Campo label="Relevado por" value={item.relevadoPor} />
          <Campo label="Día relevado" value={fmtFechaCorta(item.fechaEjecutada)} />
          <Campo label="Responsable de cierre" value={item.responsableCierre} />
          <Campo label="Fecha límite de cierre" value={fmtFechaCorta(item.fechaPlazo)} />
          {item.sectorNombre && <Campo label="Sector" value={item.sectorNombre} />}
          {item.puestoNombre && <Campo label="Puesto" value={item.puestoNombre} />}
          {item.estado === 'Cerrado' && (
            <div style={{ marginTop: 6, color: '#15803d' }}>
              <span>✓ Cerrada el {fmtFechaCorta(item.fechaCierre)}</span>
              {fotoCierre && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoCierre} alt="Evidencia de cierre" style={{ display: 'block', marginTop: 6, width: 160, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid #86efac' }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
