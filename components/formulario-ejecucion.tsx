'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGeoCaptura } from '@/lib/hooks/use-geo-captura'
import type {
  FormularioSeccion, FormularioItem,
  AnswerValue, RespuestaDraft, RegistroGestion,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { finalizarFormulario, getOrCreateRespuesta } from '@/lib/actions/formulario-ejecucion'
import { guardarBorrador } from '@/lib/actions/formulario-ejecucion-guardar'
import { crearObservaciones } from '@/lib/actions/registro-gestion'
import { PhotoCanvasEditor } from '@/components/photo-canvas-editor'
import { FirmaInternaModal } from '@/components/firmas/firma-interna-modal'
import { Camera, FileSignature, CheckCircle } from 'lucide-react'

interface ObsDraft {
  key: number
  descripcion: string
  categoria_id: string
  clasificacion_id: string
  responsable_id: string
  fecha_subsanacion: string
  foto_preview: string | null
  foto_blob: Blob | null
  foto_editing: boolean
}

interface CategoriaObs {
  id: string
  nombre: string
  nivel: number
  color: string
}

interface FullRegistro extends RegistroGestion {
  ge_gestion_nombre?: string
  ge_categoria_nombre?: string
  ge_gestion_id?: string
  ge_id?: string
}

interface Props {
  registro: FullRegistro
  establecimientoId: string
  onClose: () => void
  onSuccess: () => void
}

type ModalView = 'edit' | 'review'

const ANSWER_LABELS: Record<AnswerValue, string> = {
  cumple: 'Cumple',
  no_cumple: 'No Cumple',
  no_aplica: 'No Aplica',
}

const ANSWER_COLORS: Record<AnswerValue, string> = {
  cumple: 'bg-success hover:bg-success ring-green-300',
  no_cumple: 'bg-danger hover:bg-danger ring-red-300',
  no_aplica: 'bg-gray-400 hover:bg-gray-500 ring-gray-300',
}

const ANSWER_SEL_COLORS: Record<AnswerValue, string> = {
  cumple: 'ring-2 ring-green-500 bg-success-bg',
  no_cumple: 'ring-2 ring-red-500 bg-danger-bg',
  no_aplica: 'ring-2 ring-gray-400 bg-surface-base',
}

export function FormularioEjecucion({ registro, establecimientoId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const { capturarUbicacion } = useGeoCaptura()
  const [secciones, setSecciones] = useState<FormularioSeccion[]>([])
  const [respuestas, setRespuestas] = useState<Map<string, RespuestaDraft>>(new Map())
  const [respuestaId, setRespuestaId] = useState<string | null>(null)
  const [view, setView] = useState<ModalView>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personas, setPersonas] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [clasificaciones, setClasificaciones] = useState<{ id: string; nombre: string }[]>([])
  const [categorias, setCategorias] = useState<CategoriaObs[]>([])
  const [comentariosSeccion, setComentariosSeccion] = useState<Map<string, string>>(new Map())
  const [observacionesSeccion, setObservacionesSeccion] = useState<Map<string, ObsDraft[]>>(new Map())
  const [fechaEjecutada, setFechaEjecutada] = useState(registro.fecha_ejecutada ?? new Date().toISOString().split('T')[0])
  const [responsableId, setResponsableId] = useState(registro.responsable_id ?? '')
  const [notas, setNotas] = useState(registro.notas ?? '')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [savedOk, setSavedOk] = useState(false)
  const [firmarAhora, setFirmarAhora] = useState(false)
  const [autoDownload, setAutoDownload] = useState(true)
  const obsKeyRef = useRef(0)
  const reviewRef = useRef<HTMLDivElement>(null)

  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'

  const allItems = secciones.flatMap(s => s.formularios_items ?? [])

  function setAnswer(itemId: string, answer: AnswerValue) {
    setRespuestas(prev => {
      const next = new Map(prev)
      next.set(itemId, { item_id: itemId, answer, comment: '' })
      return next
    })
  }

  const totalItems = allItems.length
  const answeredCount = Array.from(respuestas.values()).filter(r => r.answer !== null).length
  const total = Array.from(respuestas.values()).filter(r => r.answer === 'cumple' || r.answer === 'no_cumple').length
  const noCumplen = Array.from(respuestas.values()).filter(r => r.answer === 'no_cumple').length
  const pct = total > 0 ? Math.round((1 - noCumplen / total) * 100) : 0

  useEffect(() => {
    const gid = registro.ge_gestion_id
    if (!gid) return

    supabase
      .from('formularios_secciones')
      .select('*, formularios_items(*)')
      .eq('gestion_id', gid)
      .order('order_index')
      .then(({ data }) => {
        if (data) setSecciones(data as unknown as FormularioSeccion[])
      })

    supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = ((data ?? []) as any[])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((pe: any) => pe.personas_directorio)
          .filter(Boolean)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => a.apellido.localeCompare(b.apellido))
        setPersonas(ps)
      })

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

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('auto_download_gestion').eq('id', user.id).maybeSingle()
          .then(({ data }) => setAutoDownload(data?.auto_download_gestion ?? true))
      }
    })
  }, [registro.ge_gestion_id, establecimientoId, supabase])

  async function ensureRespuesta() {
    if (respuestaId) return respuestaId
    const uid = (await supabase.auth.getUser()).data.user?.id
    if (!uid) throw new Error('No autenticado')
    if (!registro.ge_gestion_id) throw new Error('Sin gestion_id')
    const result = await getOrCreateRespuesta(registro.ge_gestion_id, establecimientoId, uid)
    if (!result.success) throw new Error(result.error)
    setRespuestaId(result.data.id)
    return result.data.id
  }

  // ── Submit ─────────────────────────────────────────────────────────
  async function handleFinalizar() {
    setSaving(true)
    setError(null)
    try {
      const rid = await ensureRespuesta()
      const formEl = view === 'review' ? reviewRef.current : null
      let pdfB64 = ''

      if (formEl) {
        const { default: html2canvas } = await import('html2canvas')
        const { default: jsPDF } = await import('jspdf')
        const canvas = await html2canvas(formEl, { scale: 2, useCORS: true, logging: false })
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        const pdf = new jsPDF('p', 'mm', 'a4')
        const pdfW = pdf.internal.pageSize.getWidth()
        const pdfH = (canvas.height * pdfW) / canvas.width
        let heightLeft = pdfH
        let position = 0
        const pageH = pdf.internal.pageSize.getHeight()

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

      const fd = new FormData()
      fd.set('registro_id', registro.id)
      fd.set('gestion_id', registro.ge_gestion_id ?? '')
      fd.set('establecimiento_id', establecimientoId)
      fd.set('respuesta_id', rid)
      fd.set('fecha_ejecutada', fechaEjecutada)
      fd.set('index', String(pct))
      fd.set('responsable_id', responsableId)
      fd.set('notas', notas)
      fd.set('evidencia_pdf', pdfB64)

      // Geo-sello: capturamos la ubicación del dispositivo justo antes de finalizar
      // la gestión. NO bloquea: si falla, se envía igual con el geo_estado correspondiente.
      const geo = await capturarUbicacion()
      fd.set('geo_lat', geo.lat != null ? String(geo.lat) : '')
      fd.set('geo_lng', geo.lng != null ? String(geo.lng) : '')
      fd.set('geo_accuracy', geo.accuracy != null ? String(geo.accuracy) : '')
      fd.set('geo_estado', geo.estado)

      if (fotoBlob) {
        fd.set('foto_evidencia', new File([fotoBlob], `foto-formulario-${Date.now()}.png`, { type: 'image/png' }))
      }

      let i = 0
      for (const [itemId, r] of respuestas) {
        if (r.answer) {
          fd.set(`item_${i}_id`, itemId)
          fd.set(`item_${i}_answer`, r.answer)
          fd.set(`item_${i}_comment`, r.comment ?? '')
          i++
        }
      }

      const result = await finalizarFormulario(null, fd)
      if (!result.success) { setError(result.error); setSaving(false); return }

      const allObs: ObsDraft[] = []
      for (const obsList of observacionesSeccion.values()) {
        allObs.push(...obsList)
      }
      const validObs = allObs.filter(o => o.descripcion.trim())
      const sinCategoria = validObs.filter(o => !o.categoria_id)
      if (sinCategoria.length > 0) {
        setError('Toda observación requiere una categoría.')
        setSaving(false)
        return
      }
      if (validObs.length > 0) {
        // No subimos en el cliente: el cliente no conoce el consultora_id. Mandamos
        // el blob como File a la server action, que resuelve el tenant y sube con
        // path tenant-prefijado, guardando el path relativo en foto_url.
        const obsConFotos = validObs.map(obs => ({
          descripcion: obs.descripcion,
          categoria_id: obs.categoria_id,
          clasificacion_id: obs.clasificacion_id,
          responsable_id: obs.responsable_id,
          fecha_subsanacion: obs.fecha_subsanacion,
          foto: obs.foto_blob
            ? new File([obs.foto_blob], `obs-${obs.key}.png`, { type: 'image/png' })
            : null,
        }))
        const obsResult = await crearObservaciones(registro.id, obsConFotos)
        if (!obsResult.success) { setError(obsResult.error); setSaving(false); return }
      }

      if (autoDownload && result.data.evidencia_url) {
        const resp = await fetch(result.data.evidencia_url)
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${registro.ge_gestion_nombre ?? 'formulario'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      setSavedOk(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  // ── Save draft ──────────────────────────────────────────────────────
  async function handleSaveDraft(): Promise<boolean> {
    setSaving(true)
    setError(null)
    try {
      const rid = await ensureRespuesta()
      const fd = new FormData()
      fd.set('registro_id', registro.id)
      fd.set('gestion_id', registro.ge_gestion_id ?? '')
      fd.set('establecimiento_id', establecimientoId)
      fd.set('respuesta_id', rid)
      fd.set('fecha_ejecutada', fechaEjecutada)
      fd.set('responsable_id', responsableId)
      fd.set('notas', notas)

      // Geo-sello: capturamos la ubicación del dispositivo al guardar el borrador.
      // NO bloquea: si falla, se envía igual con el geo_estado correspondiente.
      const geo = await capturarUbicacion()
      fd.set('geo_lat', geo.lat != null ? String(geo.lat) : '')
      fd.set('geo_lng', geo.lng != null ? String(geo.lng) : '')
      fd.set('geo_accuracy', geo.accuracy != null ? String(geo.accuracy) : '')
      fd.set('geo_estado', geo.estado)

      let i = 0
      for (const [itemId, r] of respuestas) {
        if (r.answer) {
          fd.set(`item_${i}_id`, itemId)
          fd.set(`item_${i}_answer`, r.answer)
          fd.set(`item_${i}_comment`, r.comment ?? '')
          i++
        }
      }

      const result = await guardarBorrador(null, fd)
      if (!result.success) { setError(result.error); setSaving(false); return false }
      return true
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado')
    } finally {
      setSaving(false)
    }
    return false
  }

  async function handleSaveAndReview() {
    await handleSaveDraft()
    setView('review')
  }

  async function handleDraftAndClose() {
    const ok = await handleSaveDraft()
    if (ok) onClose()
  }

  // ── Observaciones helpers per seccion ─────────────────────────────
  function getObs(secId: string): ObsDraft[] {
    return observacionesSeccion.get(secId) ?? []
  }

  function addObs(secId: string) {
    setObservacionesSeccion(prev => {
      const next = new Map(prev)
      const list = [...(next.get(secId) ?? [])]
      list.push({
        key: obsKeyRef.current++,
        descripcion: '',
        categoria_id: '',
        clasificacion_id: '',
        responsable_id: '',
        fecha_subsanacion: '',
        foto_preview: null,
        foto_blob: null,
        foto_editing: false,
      })
      next.set(secId, list)
      return next
    })
  }

  function updateObs(secId: string, obsKey: number, upd: Partial<ObsDraft>) {
    setObservacionesSeccion(prev => {
      const next = new Map(prev)
      const list = (next.get(secId) ?? []).map(o => o.key === obsKey ? { ...o, ...upd } : o)
      next.set(secId, list)
      return next
    })
  }

  function removeObs(secId: string, obsKey: number) {
    setObservacionesSeccion(prev => {
      const next = new Map(prev)
      const list = (next.get(secId) ?? []).filter(o => o.key !== obsKey)
      if (list.length === 0) next.delete(secId)
      else next.set(secId, list)
      return next
    })
  }

  function setComentario(secId: string, val: string) {
    setComentariosSeccion(prev => {
      const next = new Map(prev)
      next.set(secId, val)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────
  function renderItem(item: FormularioItem) {
    const r = respuestas.get(item.id)
    const currentAnswer = r?.answer ?? null

    return (
      <div key={item.id} className="border border-border-subtle rounded-xl p-4 bg-surface-base">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-xs font-semibold text-text-tertiary mt-0.5 shrink-0 min-w-[2rem]">
            {item.numero_item ?? '-'}
          </span>
          <p className="text-sm text-text-primary flex-1">{item.question}</p>
        </div>

        <div className="flex gap-2 ml-9">
          {(['cumple', 'no_cumple', 'no_aplica'] as AnswerValue[]).map(val => (
            <button
              key={val}
              type="button"
              onClick={() => setAnswer(item.id, val)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-all
                ${currentAnswer === val
                  ? ANSWER_SEL_COLORS[val] + ' text-text-primary'
                  : ANSWER_COLORS[val] + ' text-white opacity-70 hover:opacity-100'
                }`}
            >
              {ANSWER_LABELS[val]}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderObservacionesBlock(secId: string, _secTitle: string) {
    const obsList = getObs(secId)
    const comentario = comentariosSeccion.get(secId) ?? ''

    return (
      <div className="border-t border-border-subtle pt-3 mt-3 space-y-3">
        <textarea
          value={comentario}
          onChange={e => setComentario(secId, e.target.value)}
          placeholder="Comentario de la seccion…"
          rows={2}
          className="w-full border border-border-default rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-text-secondary">Observaciones</h4>
            <button
              type="button"
              onClick={() => addObs(secId)}
              className="text-xs text-sig-600 hover:text-sig-700 font-medium"
            >
              + Agregar
            </button>
          </div>

          {obsList.length === 0 ? (
            <p className="text-xs text-text-tertiary text-center py-2 border border-dashed border-border-subtle rounded-lg">
              Sin observaciones.
            </p>
          ) : (
            <div className="space-y-2">
              {obsList.map((obs, idx) => (
                <div key={obs.key} className="border border-border-subtle rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-text-tertiary mt-2 w-4 shrink-0">{idx + 1}.</span>
                    <textarea
                      value={obs.descripcion}
                      onChange={e => updateObs(secId, obs.key, { descripcion: e.target.value })}
                      placeholder="Descripcion de la observacion…"
                      rows={2}
                      className="flex-1 border border-border-default rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeObs(secId, obs.key)}
                      className="text-text-tertiary hover:text-red-400 mt-1 text-base leading-none shrink-0"
                    >
                      ✕
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
                        onChange={e => updateObs(secId, obs.key, { categoria_id: e.target.value })}
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
                        onChange={e => updateObs(secId, obs.key, { clasificacion_id: e.target.value })}
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
                      <select
                        value={obs.responsable_id}
                        onChange={e => updateObs(secId, obs.key, { responsable_id: e.target.value })}
                        className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                      >
                        <option value="">Sin asignar</option>
                        {personas.map(p => (
                          <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary block mb-0.5">Fecha Subsanacion</label>
                      <input
                        type="date"
                        value={obs.fecha_subsanacion}
                        onChange={e => updateObs(secId, obs.key, { fecha_subsanacion: e.target.value })}
                        className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                    </div>
                  </div>

                  {/* Foto de la observación */}
                  <div className="pl-0 sm:pl-6">
                    {!obs.foto_preview ? (
                      <label className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-sig-600 cursor-pointer transition-colors">
                        <Camera size={13} />
                        Adjuntar foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            updateObs(secId, obs.key, {
                              foto_preview: URL.createObjectURL(f),
                              foto_blob: f,
                              foto_editing: false,
                            })
                          }}
                        />
                      </label>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={obs.foto_preview} alt="Foto observación" className="w-14 h-14 object-cover rounded-lg border border-border-subtle" />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => updateObs(secId, obs.key, { foto_editing: !obs.foto_editing })}
                              className="text-xs text-sig-600 hover:text-sig-700 font-medium"
                            >
                              {obs.foto_editing ? 'Cerrar editor' : 'Editar con herramientas'}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateObs(secId, obs.key, { foto_preview: null, foto_blob: null, foto_editing: false })}
                              className="text-xs text-red-400 hover:text-danger"
                            >
                              Eliminar foto
                            </button>
                          </div>
                        </div>
                        {obs.foto_editing && (
                          <PhotoCanvasEditor
                            imageUrl={obs.foto_preview}
                            onImageChange={blob => updateObs(secId, obs.key, { foto_blob: blob })}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Saved view ─────────────────────────────────────────────────────
  if (savedOk) {
    return (
      <Modal open title="Gestión guardada" onClose={onSuccess}>
        <div className="space-y-5 py-2">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">{registro.ge_gestion_nombre}</h3>
            <p className="text-sm text-text-secondary mt-1">Guardada correctamente · {fechaEjecutada}</p>
          </div>
          <div className="flex gap-3">
            <Button type="button" onClick={() => setFirmarAhora(true)}>
              <FileSignature size={14} className="inline mr-1.5" />
              Firmar gestión
            </Button>
            <Button type="button" variant="secondary" onClick={onSuccess}>Cerrar</Button>
          </div>
        </div>
        {firmarAhora && registro.ge_id && (
          <FirmaInternaModal
            open
            gestionEstablecimientoId={registro.ge_id}
            gestionNombre={registro.ge_gestion_nombre ?? ''}
            onClose={() => setFirmarAhora(false)}
            onSuccess={onSuccess}
          />
        )}
      </Modal>
    )
  }

  // ── Edit view ──────────────────────────────────────────────────────
  if (view === 'edit') {
    return (
      <Modal open title={registro.ge_gestion_nombre ?? 'Ejecutar'} onClose={onClose} size="full">
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
          {error && (
            <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="bg-surface-base rounded-xl p-4">
            <div className="flex items-center justify-between text-sm text-text-secondary mb-2">
              <span>Progreso: {answeredCount}/{totalItems} items respondidos</span>
              {answeredCount > 0 && (
                <span className="font-semibold text-sig-700">
                  {pct}% · {noCumplen} no cumplen
                </span>
              )}
            </div>
            <div className="w-full bg-surface-sunken rounded-full h-2">
              <div
                className="bg-sig-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalItems > 0 ? (answeredCount / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-surface-base rounded-lg px-3 py-2 text-sm text-text-secondary">
            <span className="font-medium">{registro.ge_gestion_nombre ?? '—'}</span>
            {registro.ge_categoria_nombre && (
              <span className="text-text-tertiary"> · {registro.ge_categoria_nombre}</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Fecha de Ejecucion *</label>
              <input
                type="date"
                required
                value={fechaEjecutada}
                onChange={e => setFechaEjecutada(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full bg-surface-elevated rounded-lg px-3 py-2 text-sm text-text-secondary">
                Indice: <strong className="text-text-primary">{pct}%</strong> (auto)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Responsable</label>
              <select value={responsableId} onChange={e => setResponsableId(e.target.value)} className={inputCls}>
                <option value="">Sin asignar</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
              <textarea
                rows={2}
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* Foto del formulario */}
          <div className="border border-border-subtle rounded-xl p-4">
            <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
              <Camera size={15} className="text-text-tertiary" />
              Foto del Formulario
              <span className="text-xs font-normal text-text-tertiary">(opcional)</span>
            </h3>
            {!fotoPreview ? (
              <div
                onClick={() => fotoInputRef.current?.click()}
                className="border-2 border-dashed border-border-subtle rounded-xl p-6 text-center cursor-pointer hover:border-sig-400 hover:bg-sig-50/30 transition-colors"
              >
                <Camera size={28} strokeWidth={1.5} className="mx-auto text-text-tertiary mb-2" />
                <p className="text-sm text-text-tertiary">Adjuntar foto del formulario físico</p>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setFotoPreview(URL.createObjectURL(f))
                    setFotoBlob(f)
                  }}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Foto adjuntada — podés anotarla antes de guardar</span>
                  <button type="button" onClick={() => { setFotoPreview(null); setFotoBlob(null) }} className="text-xs text-danger hover:text-danger">
                    Eliminar
                  </button>
                </div>
                <PhotoCanvasEditor imageUrl={fotoPreview} onImageChange={blob => setFotoBlob(blob)} />
              </div>
            )}
          </div>

          {secciones.map(sec => (
            <div key={sec.id} className="border border-border-subtle rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-sig-500 rounded-full shrink-0" />
                {sec.title}
              </h3>
              <div className="space-y-2">
                {(sec.formularios_items ?? []).map(renderItem)}
              </div>
              {renderObservacionesBlock(sec.id, sec.title)}
            </div>
          ))}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 pb-4 sticky bottom-0 bg-surface-base">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button
                type="button"
                onClick={handleSaveAndReview}
                disabled={answeredCount === 0 || saving}
              >
                {saving ? 'Guardando…' : 'Guardar y revisar'}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
            </div>

            {answeredCount > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm text-text-secondary">
                  <strong className={noCumplen > 0 ? 'text-danger' : 'text-success'}>{pct}%</strong> · {total} auditados · {noCumplen} no cumplen
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    )
  }

  // ── Review / Preview view ──────────────────────────────────────────
  return (
    <Modal open title={`Revisar: ${registro.ge_gestion_nombre ?? ''}`} onClose={onClose} size="full">
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div ref={reviewRef} className="bg-surface-base space-y-4" style={{ padding: '8mm' }}>
          <div className="text-center border-b border-border-default pb-4 mb-4">
            <h1 className="text-xl font-bold text-text-primary">{registro.ge_gestion_nombre ?? 'Checklist'}</h1>
            <p className="text-sm text-text-secondary mt-1">
              {fechaEjecutada}
              {registro.ge_categoria_nombre ? ` · ${registro.ge_categoria_nombre}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <div className="bg-surface-base rounded-xl p-2 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-text-primary">{total}</div>
              <div className="text-[10px] sm:text-xs text-text-secondary mt-1 leading-tight">Items Auditados</div>
            </div>
            <div className="bg-surface-base rounded-xl p-2 sm:p-4 text-center">
              <div className={`text-xl sm:text-2xl font-bold ${noCumplen > 0 ? 'text-danger' : 'text-success'}`}>{noCumplen}</div>
              <div className="text-[10px] sm:text-xs text-text-secondary mt-1 leading-tight">No Cumplen</div>
            </div>
            <div className="bg-surface-base rounded-xl p-2 sm:p-4 text-center">
              <div className={`text-xl sm:text-2xl font-bold ${pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger'}`}>
                {pct}%
              </div>
              <div className="text-[10px] sm:text-xs text-text-secondary mt-1 leading-tight">Aprobacion</div>
            </div>
          </div>

          {secciones.map(sec => (
            <div key={sec.id} className="mb-4">
              <h2 className="text-sm font-bold text-text-primary mb-2 border-b border-border-subtle pb-1">{sec.title}</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-text-secondary border-b border-border-subtle">
                    <th className="text-left py-1 pr-2 w-10">N°</th>
                    <th className="text-left py-1 pr-2">Item</th>
                    <th className="text-center py-1 w-24">Respuesta</th>
                  </tr>
                </thead>
                <tbody>
                  {(sec.formularios_items ?? []).map(item => {
                    const r = respuestas.get(item.id)
                    const ansColor = r?.answer === 'cumple' ? 'text-success bg-success-bg'
                      : r?.answer === 'no_cumple' ? 'text-danger bg-danger-bg'
                      : r?.answer === 'no_aplica' ? 'text-text-secondary bg-surface-base'
                      : 'text-text-tertiary'
                    return (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2 text-text-tertiary text-xs align-top">{item.numero_item ?? '-'}</td>
                        <td className="py-1.5 pr-2 text-text-primary">{item.question}</td>
                        <td className={`py-1.5 text-center text-xs font-medium rounded ${ansColor}`}>
                          {r?.answer ? ANSWER_LABELS[r.answer] : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {comentariosSeccion.get(sec.id) && (
                <p className="text-xs text-text-secondary italic mt-2">
                  {comentariosSeccion.get(sec.id)}
                </p>
              )}
              {getObs(sec.id).length > 0 && (
                <div className="mt-2 space-y-1">
                  {getObs(sec.id).map((obs, idx) => (
                    <p key={obs.key} className="text-xs text-text-secondary">
                      <strong>Obs {idx + 1}:</strong> {obs.descripcion}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 sm:gap-3 pt-2 pb-4 sticky bottom-0 bg-surface-base">
            <Button type="button" variant="secondary" onClick={() => setView('edit')} disabled={saving}>
              Seguir Editando
            </Button>
            <Button type="button" onClick={handleFinalizar} disabled={saving}>
              {saving ? 'Guardando…' : 'Finalizar y guardar'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleDraftAndClose} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar y continuar luego'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
