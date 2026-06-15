'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { crearReporteFotograficoEjecucion } from '@/lib/actions/reporte-fotografico'
import { PhotoCanvasEditor } from '@/components/photo-canvas-editor'
import type { DrawObject } from '@/components/photo-canvas-editor'
import { PersonaSelector } from '@/components/persona-selector'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FotoInput } from '@/components/ui/foto-input'
import {
  Camera, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Trash2, Download, Copy, Share2, CheckCircle, Loader2,
} from 'lucide-react'
import { PUNTOS_POR_NIVEL } from '@/lib/reportes/observaciones-campo-tipos'

interface ReporteFotograficoEjecutorModalProps {
  registroId: string
  gestionEstablecimientoId: string
  establecimientoId: string
  empresaId: string
  gestionNombre: string
  rgFechaPlanificada: string
  establecimientoNombre?: string
  onClose: () => void
  onSuccess: () => void
}

interface CategoriaObs {
  id: string
  nombre: string
  nivel: number
  color: string
}

interface ObsFoto {
  key: number
  descripcion: string
  categoria_id: string
  clasificacion_id: string
  responsable_id: string | null
  fecha_subsanacion: string
}

interface FotoItem {
  key: number
  /** Object URL del original (para mostrar/editar). */
  previewUrl: string
  /** Blob editado (PNG del editor). Si null, se usa el File original al enviar. */
  editedBlob: Blob | null
  /** Object URL del blob editado (para el review/PDF). Se revoca al reemplazar. */
  editedUrl: string | null
  /** File original seleccionado. */
  originalFile: File
  /** Objetos de dibujo del editor, persistidos para sobrevivir al re-montaje. */
  annotations: DrawObject[]
  observaciones: ObsFoto[]
}

type Periodicidad = 'semanal' | 'mensual' | 'periodico'
type WizardStep = 'upload' | 'periodo' | 'editor' | 'guardar' | 'listo'

const STEP_ORDER: WizardStep[] = ['upload', 'periodo', 'editor', 'guardar']
const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Fotos',
  periodo: 'Período',
  editor: 'Editar',
  guardar: 'Evaluar',
  listo: 'Listo',
}

export function ReporteFotograficoEjecutorModal({
  registroId,
  gestionEstablecimientoId,
  establecimientoId,
  empresaId: _empresaId,
  gestionNombre,
  rgFechaPlanificada,
  establecimientoNombre,
  onClose,
  onSuccess,
}: ReporteFotograficoEjecutorModalProps) {
  const [step, setStep] = useState<WizardStep>('upload')
  const [fotos, setFotos] = useState<FotoItem[]>([])
  const [fotoActiva, setFotoActiva] = useState(0)

  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('mensual')
  const [periodoDesde, setPeriodoDesde] = useState('')
  const [periodoHasta, setPeriodoHasta] = useState('')
  const [comentario, setComentario] = useState('')

  const [clasificaciones, setClasificaciones] = useState<{ id: string; nombre: string }[]>([])
  const [categorias, setCategorias] = useState<CategoriaObs[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  const fotoKeyRef = useRef(0)
  const obsKeyRef = useRef(0)
  const reviewRef = useRef<HTMLDivElement>(null)

  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'

  // Catálogos de observaciones (el responsable usa PersonaSelector, que carga su
  // propia lista de personas de la consultora).
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('observaciones_clasificaciones')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setClasificaciones((data ?? []) as { id: string; nombre: string }[]))
    supabase
      .from('observaciones_categorias')
      .select('id, nombre, nivel, color')
      .eq('is_active', true)
      .order('nivel')
      .then(({ data }) => setCategorias((data ?? []) as CategoriaObs[]))
  }, [establecimientoId])

  // Liberar object URLs al desmontar. Con deps [] el cleanup capturaria el snapshot
  // vacio de `fotos` del montaje y no revocaria nada; usamos una ref al array actual.
  const fotosRef = useRef(fotos)
  fotosRef.current = fotos
  useEffect(() => {
    return () => {
      for (const f of fotosRef.current) {
        URL.revokeObjectURL(f.previewUrl)
        if (f.editedUrl) URL.revokeObjectURL(f.editedUrl)
      }
    }
  }, [])

  // ── Upload helpers ────────────────────────────────────────────────
  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (arr.length === 0) return
    setFotos(prev => [
      ...prev,
      ...arr.map(f => ({
        key: fotoKeyRef.current++,
        previewUrl: URL.createObjectURL(f),
        editedBlob: null,
        editedUrl: null,
        originalFile: f,
        annotations: [],
        observaciones: [],
      })),
    ])
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  function removeFoto(key: number) {
    setFotos(prev => {
      const target = prev.find(f => f.key === key)
      if (target) {
        URL.revokeObjectURL(target.previewUrl)
        if (target.editedUrl) URL.revokeObjectURL(target.editedUrl)
      }
      const next = prev.filter(f => f.key !== key)
      setFotoActiva(a => Math.min(a, Math.max(0, next.length - 1)))
      return next
    })
  }

  function moveFoto(idx: number, dir: -1 | 1) {
    setFotos(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  // ── Editor / observaciones por foto ───────────────────────────────
  // Ref para flushear el canvas del editor activo a PNG antes de navegar
  // (sin depender del debounce de 500ms, que se cancelaba al desmontar).
  const exportControlRef = useRef<(() => Promise<Blob | null>) | null>(null)

  function setEditedBlob(fotoKey: number, blob: Blob) {
    setFotos(prev => prev.map(f => {
      if (f.key !== fotoKey) return f
      // Revocar la URL anterior antes de crear la nueva: el review lee editedUrl
      // directamente, así siempre refleja el último blob (con sus anotaciones).
      if (f.editedUrl) URL.revokeObjectURL(f.editedUrl)
      return { ...f, editedBlob: blob, editedUrl: URL.createObjectURL(blob) }
    }))
  }

  function setFotoAnnotations(fotoKey: number, annotations: DrawObject[]) {
    setFotos(prev => prev.map(f => (f.key === fotoKey ? { ...f, annotations } : f)))
  }

  // Exporta el canvas del editor activo a PNG y lo guarda como editedBlob/editedUrl.
  async function flushActiveFoto() {
    const activa = fotos[fotoActiva]
    if (!activa) return
    const blob = await exportControlRef.current?.()
    if (blob) setEditedBlob(activa.key, blob)
  }

  function addObsFromEditor(fotoKey: number, descripcion: string, categoriaId: string) {
    setFotos(prev => prev.map(f => f.key === fotoKey ? {
      ...f,
      observaciones: [...f.observaciones, {
        key: obsKeyRef.current++,
        descripcion,
        categoria_id: categoriaId,
        clasificacion_id: '',
        responsable_id: null,
        fecha_subsanacion: '',
      }],
    } : f))
  }

  function addObsManual(fotoKey: number) {
    setFotos(prev => prev.map(f => f.key === fotoKey ? {
      ...f,
      observaciones: [...f.observaciones, {
        key: obsKeyRef.current++,
        descripcion: '',
        categoria_id: '',
        clasificacion_id: '',
        responsable_id: null,
        fecha_subsanacion: '',
      }],
    } : f))
  }

  function updateObs(fotoKey: number, obsKey: number, upd: Partial<ObsFoto>) {
    setFotos(prev => prev.map(f => f.key === fotoKey ? {
      ...f,
      observaciones: f.observaciones.map(o => o.key === obsKey ? { ...o, ...upd } : o),
    } : f))
  }

  function removeObs(fotoKey: number, obsKey: number) {
    setFotos(prev => prev.map(f => f.key === fotoKey ? {
      ...f,
      observaciones: f.observaciones.filter(o => o.key !== obsKey),
    } : f))
  }

  // ── Navegación wizard ─────────────────────────────────────────────
  async function goNext() {
    setError(null)
    if (step === 'upload') {
      if (fotos.length === 0) { setError('Subí al menos una foto.'); return }
      setStep('periodo')
    } else if (step === 'periodo') {
      setStep('editor')
      setFotoActiva(0)
    } else if (step === 'editor') {
      await flushActiveFoto()
      setStep('guardar')
    }
  }

  async function goBack() {
    setError(null)
    if (step === 'editor') await flushActiveFoto()
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
  }

  // Aseguramos un Blob por foto: si no se editó, rasterizamos el original a PNG.
  async function fileToBlob(file: File): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('No se pudo crear el contexto 2d')); return }
          ctx.drawImage(img, 0, 0)
          canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob falló'))), 'image/png')
        }
        img.onerror = () => reject(new Error('No se pudo leer la imagen'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })
  }

  // ── Evaluar y guardar ─────────────────────────────────────────────
  async function handleGuardar() {
    setError(null)

    // Validación: toda observación con descripción debe tener categoría.
    const sinCat = fotos.some(f => f.observaciones.some(o => o.descripcion.trim() && !o.categoria_id))
    if (sinCat) {
      setError('Toda observación requiere una categoría.')
      return
    }

    setSaving(true)
    try {
      // 1. PDF del nodo de review (html2canvas + jsPDF, multipágina).
      let pdfB64 = ''
      const node = reviewRef.current
      if (node) {
        const { default: html2canvas } = await import('html2canvas')
        const { default: jsPDF } = await import('jspdf')
        const canvas = await html2canvas(node, { scale: 2, useCORS: true, logging: false })
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
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
        pdfB64 = pdf.output('datauristring')
      }

      // 2. Armamos el FormData.
      const fd = new FormData()
      fd.set('registro_id', registroId)
      fd.set('establecimiento_id', establecimientoId)
      fd.set('gestion_establecimiento_id', gestionEstablecimientoId)
      fd.set('rg_fecha_planificada', rgFechaPlanificada)
      fd.set('periodicidad', periodicidad)
      fd.set('periodo_desde', periodoDesde)
      fd.set('periodo_hasta', periodoHasta)
      fd.set('comentario', comentario)
      fd.set('pdf', pdfB64)
      fd.set('foto_count', String(fotos.length))

      const observaciones: Array<{
        foto_index: number
        descripcion: string
        categoria_id: string
        clasificacion_id: string
        responsable_id: string | null
        fecha_subsanacion: string
      }> = []

      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i]
        const blob = f.editedBlob ?? (await fileToBlob(f.originalFile))
        fd.set(`foto-${i}`, new File([blob], `foto-${i}.png`, { type: 'image/png' }))
        for (const o of f.observaciones) {
          if (!o.descripcion.trim()) continue
          observaciones.push({
            foto_index: i,
            descripcion: o.descripcion,
            categoria_id: o.categoria_id,
            clasificacion_id: o.clasificacion_id,
            responsable_id: o.responsable_id,
            fecha_subsanacion: o.fecha_subsanacion,
          })
        }
      }
      fd.set('observaciones', JSON.stringify(observaciones))

      const result = await crearReporteFotograficoEjecucion(fd)
      if (!result.success) { setError(result.error); setSaving(false); return }

      setPdfSignedUrl(result.data.pdfSignedUrl)
      setStep('listo')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al generar el reporte')
    } finally {
      setSaving(false)
    }
  }

  // ── Post-guardado: descargar / compartir ──────────────────────────
  async function handleDescargar() {
    if (!pdfSignedUrl) return
    try {
      const resp = await fetch(pdfSignedUrl)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${gestionNombre || 'reporte-fotografico'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Si el fetch falla (CORS, expirado), abrimos en una pestaña como fallback.
      window.open(pdfSignedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function handleCopiarLink() {
    if (!pdfSignedUrl) return
    navigator.clipboard.writeText(pdfSignedUrl).then(() => {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    }).catch(() => {})
  }

  const waText = encodeURIComponent(
    `Reporte Fotográfico — ${establecimientoNombre ?? gestionNombre}\n${pdfSignedUrl ?? ''}`
  )
  const waHref = `https://wa.me/?text=${waText}`

  const totalObs = fotos.reduce((acc, f) => acc + f.observaciones.filter(o => o.descripcion.trim()).length, 0)
  const puntajeObs = fotos.reduce((acc, f) => {
    return acc + f.observaciones
      .filter(o => o.descripcion.trim() && o.categoria_id)
      .reduce((s, o) => {
        const nivel = categorias.find(c => c.id === o.categoria_id)?.nivel ?? 0
        return s + (PUNTOS_POR_NIVEL[nivel] ?? 0)
      }, 0)
  }, 0)
  const stepIdx = STEP_ORDER.indexOf(step)

  // ── Render: post-guardado ─────────────────────────────────────────
  if (step === 'listo') {
    return (
      <Modal open title="Reporte generado" onClose={onClose} size="full">
        <div className="space-y-5 py-2">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">{gestionNombre}</h3>
            <p className="text-sm text-text-secondary mt-1">
              Reporte guardado · {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
              {totalObs > 0 && ` · ${totalObs} ${totalObs === 1 ? 'observación' : 'observaciones'}`}
            </p>
            {totalObs > 0 && (
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="bg-surface-elevated rounded-lg px-4 py-2 text-center border border-border-subtle">
                  <div className="text-xl font-bold text-text-primary">{totalObs}</div>
                  <div className="text-xs text-text-tertiary">Observaciones</div>
                </div>
                <div className="bg-amber-50 rounded-lg px-4 py-2 text-center border border-amber-200">
                  <div className="text-xl font-bold text-amber-800">{puntajeObs} pts</div>
                  <div className="text-xs text-amber-700">Índice de riesgo</div>
                </div>
              </div>
            )}
          </div>

          {pdfSignedUrl ? (
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 justify-center">
              <Button type="button" onClick={handleDescargar}>
                <Download size={14} className="inline mr-1.5" />
                Descargar PDF
              </Button>
              <Button type="button" variant="secondary" onClick={handleCopiarLink}>
                <Copy size={14} className="inline mr-1.5" />
                {linkCopiado ? 'Link copiado' : 'Copiar link'}
              </Button>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-lg text-sm font-medium border border-border-default text-text-secondary hover:bg-surface-base transition-colors"
              >
                <Share2 size={14} />
                Compartir por WhatsApp
              </a>
            </div>
          ) : (
            <p className="text-sm text-amber-600 text-center">
              El reporte se guardó, pero no se pudo generar el link de descarga del PDF.
            </p>
          )}

          <div className="flex justify-center pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </Modal>
    )
  }

  const fotoEnEdicion = fotos[fotoActiva]

  return (
    <Modal open title={`Reporte Fotográfico — ${gestionNombre}`} onClose={onClose} size="wide">
      <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
        {/* Stepper */}
        <div className="flex items-center gap-1.5 text-xs">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold ${
                i === stepIdx ? 'bg-sig-500 text-white' : i < stepIdx ? 'bg-success text-white' : 'bg-surface-sunken text-text-tertiary'
              }`}>
                {i + 1}
              </span>
              <span className={i === stepIdx ? 'font-semibold text-text-primary' : 'text-text-tertiary'}>
                {STEP_LABELS[s]}
              </span>
              {i < STEP_ORDER.length - 1 && <ChevronRight size={12} className="text-text-tertiary" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        {/* ── PASO 1: UPLOAD ──────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-3">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border-default rounded-xl p-8 text-center transition-colors"
            >
              <Camera size={36} strokeWidth={1.5} className="mx-auto text-text-tertiary mb-2" />
              <p className="text-sm font-medium text-text-secondary mb-1">Cargá las fotos</p>
              <p className="text-xs text-text-tertiary mb-3">Sacá una foto, elegí varias de la galería o arrastrálas acá</p>
              <FotoInput multiple onChange={handleFileInput} className="justify-center" />
            </div>

            {fotos.length > 0 && (
              <div>
                <p className="text-xs text-text-secondary mb-2">{fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'} · ordená con las flechas</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {fotos.map((f, idx) => (
                    <div key={f.key} className="relative group border border-border-subtle rounded-lg overflow-hidden bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.previewUrl} alt={`Foto ${idx + 1}`} className="w-full h-28 object-cover" />
                      <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] rounded px-1.5 py-0.5">{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeFoto(f.key)}
                        title="Quitar"
                        className="absolute top-1 right-1 bg-black/60 text-white rounded p-1 hover:bg-danger"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="absolute bottom-1 right-1 flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveFoto(idx, -1)}
                          disabled={idx === 0}
                          title="Mover antes"
                          className="bg-black/60 text-white rounded p-1 hover:bg-sig-500 disabled:opacity-30"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFoto(idx, 1)}
                          disabled={idx === fotos.length - 1}
                          title="Mover después"
                          className="bg-black/60 text-white rounded p-1 hover:bg-sig-500 disabled:opacity-30"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PASO 2: PERÍODO ─────────────────────────────────────── */}
        {step === 'periodo' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Periodicidad</label>
              <select
                value={periodicidad}
                onChange={e => setPeriodicidad(e.target.value as Periodicidad)}
                className={inputCls}
              >
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="periodico">Periódico</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Período desde</label>
                <input type="date" value={periodoDesde} onChange={e => setPeriodoDesde(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Período hasta</label>
                <input type="date" value={periodoHasta} onChange={e => setPeriodoHasta(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Comentario</label>
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                rows={3}
                placeholder="Comentario general del reporte…"
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        )}

        {/* ── PASO 3: EDITOR FOTO-POR-FOTO ────────────────────────── */}
        {step === 'editor' && fotoEnEdicion && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={async () => { await flushActiveFoto(); setFotoActiva(a => Math.max(0, a - 1)) }}
                disabled={fotoActiva === 0}
                className="inline-flex items-center gap-1 text-sm text-sig-600 hover:text-sig-700 disabled:opacity-30"
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="text-sm font-medium text-text-secondary">
                Foto {fotoActiva + 1} de {fotos.length}
              </span>
              <button
                type="button"
                onClick={async () => { await flushActiveFoto(); setFotoActiva(a => Math.min(fotos.length - 1, a + 1)) }}
                disabled={fotoActiva === fotos.length - 1}
                className="inline-flex items-center gap-1 text-sm text-sig-600 hover:text-sig-700 disabled:opacity-30"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>

            {/* Editor de la foto activa. key fuerza remount al cambiar de foto. */}
            <PhotoCanvasEditor
              key={fotoEnEdicion.key}
              imageUrl={fotoEnEdicion.previewUrl}
              onImageChange={blob => setEditedBlob(fotoEnEdicion.key, blob)}
              enableObservacionTool
              categorias={categorias}
              onObservacionAdded={(desc, catId) => addObsFromEditor(fotoEnEdicion.key, desc, catId)}
              initialObjects={fotoEnEdicion.annotations}
              onObjectsChange={objs => setFotoAnnotations(fotoEnEdicion.key, objs)}
              exportControl={exportControlRef}
            />

            {/* Observaciones de esta foto */}
            <div className="border-t border-border-subtle pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-text-secondary">
                  Observaciones de esta foto
                  {fotoEnEdicion.observaciones.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-text-tertiary">({fotoEnEdicion.observaciones.length})</span>
                  )}
                </h4>
                <button
                  type="button"
                  onClick={() => addObsManual(fotoEnEdicion.key)}
                  className="text-xs text-sig-600 hover:text-sig-700 font-medium"
                >
                  + Agregar
                </button>
              </div>

              {fotoEnEdicion.observaciones.length === 0 ? (
                <p className="text-xs text-text-tertiary text-center py-2 border border-dashed border-border-subtle rounded-lg">
                  Sin observaciones. Usá la herramienta sobre la foto o &quot;+ Agregar&quot;.
                </p>
              ) : (
                <div className="space-y-2">
                  {fotoEnEdicion.observaciones.map((obs, idx) => (
                    <div key={obs.key} className="border border-border-subtle rounded-lg p-3 space-y-2 bg-gray-50/50">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-text-tertiary mt-2 w-4 shrink-0">{idx + 1}.</span>
                        <textarea
                          value={obs.descripcion}
                          onChange={e => updateObs(fotoEnEdicion.key, obs.key, { descripcion: e.target.value })}
                          placeholder="Descripción de la observación…"
                          rows={2}
                          className="flex-1 border border-border-default rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeObs(fotoEnEdicion.key, obs.key)}
                          className="text-text-tertiary hover:text-red-400 mt-1 shrink-0"
                          title="Eliminar observación"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pl-0 sm:pl-6">
                        <div>
                          <label className="text-xs text-text-secondary block mb-0.5">
                            Categoría <span className="text-danger">*</span>
                          </label>
                          <select
                            required
                            value={obs.categoria_id}
                            onChange={e => updateObs(fotoEnEdicion.key, obs.key, { categoria_id: e.target.value })}
                            className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                            style={obs.categoria_id ? { backgroundColor: categorias.find(c => c.id === obs.categoria_id)?.color, color: '#000' } : {}}
                          >
                            <option value="">Seleccionar…</option>
                            {categorias.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-text-secondary block mb-0.5">Tipo de riesgo</label>
                          <select
                            value={obs.clasificacion_id}
                            onChange={e => updateObs(fotoEnEdicion.key, obs.key, { clasificacion_id: e.target.value })}
                            className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                          >
                            <option value="">Sin clasificar</option>
                            {clasificaciones.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-text-secondary block mb-0.5">Responsable</label>
                          <PersonaSelector
                            name={`responsable-${fotoEnEdicion.key}-${obs.key}`}
                            value={obs.responsable_id}
                            onChange={v => updateObs(fotoEnEdicion.key, obs.key, { responsable_id: v })}
                            placeholder="Buscar responsable…"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-text-secondary block mb-0.5">Fecha subsanación</label>
                          <input
                            type="date"
                            value={obs.fecha_subsanacion}
                            onChange={e => updateObs(fotoEnEdicion.key, obs.key, { fecha_subsanacion: e.target.value })}
                            className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PASO 4: EVALUAR Y GUARDAR (nodo de review = PDF) ────── */}
        {step === 'guardar' && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Revisá el reporte antes de generarlo. Esto crea el PDF, guarda las fotos y suma las
              observaciones al Seguimiento.
            </p>

            <div ref={reviewRef} className="bg-white space-y-4" style={{ padding: '8mm' }}>
              {/* Portada */}
              <div className="text-center border-b border-gray-300 pb-4 mb-2">
                <h1 className="text-xl font-bold text-gray-900">{gestionNombre}</h1>
                {establecimientoNombre && (
                  <p className="text-sm text-gray-700 mt-1">{establecimientoNombre}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Periodicidad: {periodicidad}
                  {periodoDesde && ` · Desde ${periodoDesde}`}
                  {periodoHasta && ` · Hasta ${periodoHasta}`}
                </p>
                <p className="text-xs text-gray-500">Fecha planificada: {rgFechaPlanificada}</p>
                {comentario && <p className="text-sm text-gray-700 italic mt-2">{comentario}</p>}
                {totalObs > 0 && (
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <div className="border border-gray-200 rounded-lg px-5 py-2 text-center bg-gray-50">
                      <div className="text-2xl font-bold text-gray-900">{totalObs}</div>
                      <div className="text-xs text-gray-500">Observaciones</div>
                    </div>
                    <div className="border border-amber-300 rounded-lg px-5 py-2 text-center bg-amber-50">
                      <div className="text-2xl font-bold text-amber-800">{puntajeObs} pts</div>
                      <div className="text-xs text-amber-700">Índice de riesgo</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 1 bloque por foto */}
              {fotos.map((f, idx) => {
                const obsValidas = f.observaciones.filter(o => o.descripcion.trim())
                const editedUrl = f.editedUrl ?? f.previewUrl
                return (
                  <div key={f.key} className="break-inside-avoid">
                    <h2 className="text-sm font-bold text-gray-900 mb-2">Foto {idx + 1}</h2>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editedUrl} alt={`Foto ${idx + 1}`} className="w-full max-h-80 object-contain rounded-lg border border-gray-200" />
                    {obsValidas.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {obsValidas.map((o, oi) => {
                          const cat = categorias.find(c => c.id === o.categoria_id)
                          return (
                            <p key={o.key} className="text-xs text-gray-700">
                              <strong>Obs {oi + 1}:</strong> {o.descripcion}
                              {cat && <span className="ml-1 text-gray-500">[{cat.nombre}]</span>}
                            </p>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer: navegación */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 pb-2 sticky bottom-0 bg-surface-base border-t border-border-subtle">
          {step !== 'upload' && (
            <Button type="button" variant="secondary" onClick={goBack} disabled={saving}>
              <ChevronLeft size={14} className="inline mr-1" /> Atrás
            </Button>
          )}
          {step !== 'guardar' ? (
            <Button type="button" onClick={goNext}>
              Continuar <ChevronRight size={14} className="inline ml-1" />
            </Button>
          ) : (
            <Button type="button" onClick={handleGuardar} disabled={saving}>
              {saving ? (
                <><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Generando…</>
              ) : 'Evaluar y guardar'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
