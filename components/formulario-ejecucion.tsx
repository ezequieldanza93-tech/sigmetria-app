'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  FormularioSeccion, FormularioItem,
  AnswerValue, RespuestaDraft, RegistroGestion,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { finalizarFormulario, getOrCreateRespuesta } from '@/lib/actions/formulario-ejecucion'
import { crearObservaciones } from '@/lib/actions/registro-gestion'

interface ObsDraft {
  key: number
  descripcion: string
  clasificacion_id: string
  responsable_id: string
  fecha_subsanacion: string
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
  cumple: 'bg-green-500 hover:bg-green-600 ring-green-300',
  no_cumple: 'bg-red-500 hover:bg-red-600 ring-red-300',
  no_aplica: 'bg-gray-400 hover:bg-gray-500 ring-gray-300',
}

const ANSWER_SEL_COLORS: Record<AnswerValue, string> = {
  cumple: 'ring-2 ring-green-500 bg-green-50',
  no_cumple: 'ring-2 ring-red-500 bg-red-50',
  no_aplica: 'ring-2 ring-gray-400 bg-gray-50',
}

export function FormularioEjecucion({ registro, establecimientoId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [secciones, setSecciones] = useState<FormularioSeccion[]>([])
  const [respuestas, setRespuestas] = useState<Map<string, RespuestaDraft>>(new Map())
  const [respuestaId, setRespuestaId] = useState<string | null>(null)
  const [view, setView] = useState<ModalView>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personas, setPersonas] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [clasificaciones, setClasificaciones] = useState<{ id: string; nombre: string }[]>([])
  const [observaciones, setObservaciones] = useState<ObsDraft[]>([])
  const [fechaEjecutada, setFechaEjecutada] = useState(registro.fecha_ejecutada ?? new Date().toISOString().split('T')[0])
  const [responsableId, setResponsableId] = useState(registro.responsable_id ?? '')
  const [notas, setNotas] = useState(registro.notas ?? '')
  const obsKeyRef = useRef(0)
  const reviewRef = useRef<HTMLDivElement>(null)

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500'

  // ── Item helpers ─────────────────────────────────────────────────────
  const allItems = secciones.flatMap(s => s.formulario_items ?? [])

  function setAnswer(itemId: string, answer: AnswerValue) {
    setRespuestas(prev => {
      const next = new Map(prev)
      const existing = next.get(itemId)
      next.set(itemId, { item_id: itemId, answer, comment: existing?.comment ?? '' })
      return next
    })
  }

  function setComment(itemId: string, comment: string) {
    setRespuestas(prev => {
      const next = new Map(prev)
      const existing = next.get(itemId) ?? { item_id: itemId, answer: null, comment: '' }
      next.set(itemId, { ...existing, comment })
      return next
    })
  }

  // ── Stats ──────────────────────────────────────────────────────────
  const totalItems = allItems.length
  const answeredCount = Array.from(respuestas.values()).filter(r => r.answer !== null).length
  const total = Array.from(respuestas.values()).filter(r => r.answer === 'cumple' || r.answer === 'no_cumple').length
  const noCumplen = Array.from(respuestas.values()).filter(r => r.answer === 'no_cumple').length
  const pct = total > 0 ? Math.round((1 - noCumplen / total) * 100) : 0

  // ── Load data ──────────────────────────────────────────────────────
  useEffect(() => {
    const gid = registro.ge_gestion_id
    if (!gid) return

    supabase
      .from('formulario_secciones')
      .select('*, formulario_items(*)')
      .eq('gestion_id', gid)
      .order('order_index')
      .then(({ data }) => {
        if (data) setSecciones(data as unknown as FormularioSeccion[])
      })

    supabase
      .from('persona_establecimiento')
      .select('directorio_personas!persona_id(id, nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const ps = ((data ?? []) as any[])
          .map((pe: any) => pe.directorio_personas)
          .filter(Boolean)
          .sort((a: any, b: any) => a.apellido.localeCompare(b.apellido))
        setPersonas(ps)
      })

    supabase
      .from('clasificacion_observaciones')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setClasificaciones((data ?? []) as { id: string; nombre: string }[]))
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
  async function handleFinalizar(downloadPdf: boolean) {
    setSaving(true)
    setError(null)
    try {
      const rid = await ensureRespuesta()
      const formEl = view === 'review' ? reviewRef.current : null
      let pdfB64 = ''

      // Generate PDF from review content
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

      // Build FormData for the server action
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

      // Save observaciones
      const validObs = observaciones.filter(o => o.descripcion.trim())
      if (validObs.length > 0) {
        const obsResult = await crearObservaciones(registro.id, validObs)
        if (!obsResult.success) { setError(obsResult.error); setSaving(false); return }
      }

      if (downloadPdf && result.data.evidencia_url) {
        const a = document.createElement('a')
        a.href = result.data.evidencia_url
        a.download = `${registro.ge_gestion_nombre ?? 'formulario'}.pdf`
        a.target = '_blank'
        a.click()
      }

      onSuccess()
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  // ── Render items ───────────────────────────────────────────────────
  function renderItem(item: FormularioItem) {
    const r = respuestas.get(item.id)
    const currentAnswer = r?.answer ?? null

    return (
      <div key={item.id} className="border border-gray-200 rounded-xl p-4 bg-white">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-xs font-semibold text-gray-400 mt-0.5 shrink-0 min-w-[2rem]">
            {item.numero_item ?? '-'}
          </span>
          <p className="text-sm text-gray-900 flex-1">{item.question}</p>
        </div>

        <div className="flex gap-2 ml-9">
          {(['cumple', 'no_cumple', 'no_aplica'] as AnswerValue[]).map(val => (
            <button
              key={val}
              type="button"
              onClick={() => setAnswer(item.id, val)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-all
                ${currentAnswer === val
                  ? ANSWER_SEL_COLORS[val] + ' text-gray-900'
                  : ANSWER_COLORS[val] + ' text-white opacity-70 hover:opacity-100'
                }`}
            >
              {ANSWER_LABELS[val]}
            </button>
          ))}
        </div>

        <div className="ml-9 mt-2">
          <input
            type="text"
            placeholder="Comentario…"
            value={r?.comment ?? ''}
            onChange={e => setComment(item.id, e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sig-300"
          />
        </div>
      </div>
    )
  }

  // ── Edit view ──────────────────────────────────────────────────────
  if (view === 'edit') {
    return (
      <Modal open title={registro.ge_gestion_nombre ?? 'Ejecutar'} onClose={onClose} size="full">
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Progress bar */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Progreso: {answeredCount}/{totalItems} items respondidos</span>
              {answeredCount > 0 && (
                <span className="font-semibold text-sig-700">
                  {pct}% · {noCumplen} no cumplen
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-sig-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalItems > 0 ? (answeredCount / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Section: info adicional */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
            <span className="font-medium">{registro.ge_gestion_nombre ?? '—'}</span>
            {registro.ge_categoria_nombre && (
              <span className="text-gray-400"> · {registro.ge_categoria_nombre}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fecha de Ejecución *</label>
              <input
                type="date"
                required
                value={fechaEjecutada}
                onChange={e => setFechaEjecutada(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
                Índice: <strong className="text-gray-800">{pct}%</strong> (auto)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Responsable</label>
              <select value={responsableId} onChange={e => setResponsableId(e.target.value)} className={inputCls}>
                <option value="">Sin asignar</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
              <textarea
                rows={2}
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* Form items */}
          {secciones.map(sec => (
            <div key={sec.id}>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-sig-500 rounded-full" />
                {sec.title}
              </h3>
              <div className="space-y-2">
                {(sec.formulario_items ?? []).map(renderItem)}
              </div>
            </div>
          ))}

          {/* Observaciones (same as EjecucionModal) */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Observaciones
                {observaciones.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">({observaciones.length})</span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setObservaciones(prev => [...prev, {
                    key: obsKeyRef.current++,
                    descripcion: '',
                    clasificacion_id: '',
                    responsable_id: '',
                    fecha_subsanacion: '',
                  }])
                }}
                className="text-xs text-sig-600 hover:text-sig-700 font-medium flex items-center gap-1"
              >
                + Agregar
              </button>
            </div>
            {observaciones.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
                Sin observaciones. Hacé clic en &quot;+ Agregar&quot; para registrar una.
              </p>
            ) : (
              <div className="space-y-2">
                {observaciones.map((obs, idx) => (
                  <div key={obs.key} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-400 mt-2 w-4 shrink-0">{idx + 1}.</span>
                      <textarea
                        value={obs.descripcion}
                        onChange={e => setObservaciones(prev => prev.map(o => o.key === obs.key ? { ...o, descripcion: e.target.value } : o))}
                        placeholder="Descripción de la observación…"
                        rows={2}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                      <button
                        type="button"
                        onClick={() => setObservaciones(prev => prev.filter(o => o.key !== obs.key))}
                        className="text-gray-300 hover:text-red-400 mt-1 text-base leading-none shrink-0"
                        title="Eliminar observación"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">Tipo de riesgo</label>
                        <select
                          value={obs.clasificacion_id}
                          onChange={e => setObservaciones(prev => prev.map(o => o.key === obs.key ? { ...o, clasificacion_id: e.target.value } : o))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                        >
                          <option value="">Sin clasificar</option>
                          {clasificaciones.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">Responsable</label>
                        <select
                          value={obs.responsable_id}
                          onChange={e => setObservaciones(prev => prev.map(o => o.key === obs.key ? { ...o, responsable_id: e.target.value } : o))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                        >
                          <option value="">Sin asignar</option>
                          {personas.map(p => (
                            <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-0.5">Fecha subsanación</label>
                        <input
                          type="date"
                          value={obs.fecha_subsanacion}
                          onChange={e => setObservaciones(prev => prev.map(o => o.key === obs.key ? { ...o, fecha_subsanacion: e.target.value } : o))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 pb-4 sticky bottom-0 bg-white">
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setView('review')}
                disabled={answeredCount === 0 || saving}
              >
                Revisar Gestión
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
            </div>

            {answeredCount > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  <strong className={noCumplen > 0 ? 'text-red-600' : 'text-green-600'}>{pct}%</strong> · {total} auditados · {noCumplen} no cumplen
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
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div ref={reviewRef} className="bg-white space-y-4" style={{ padding: '8mm' }}>
          {/* Header */}
          <div className="text-center border-b border-gray-300 pb-4 mb-4">
            <h1 className="text-xl font-bold text-gray-900">{registro.ge_gestion_nombre ?? 'Checklist'}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {fechaEjecutada}
              {registro.ge_categoria_nombre ? ` · ${registro.ge_categoria_nombre}` : ''}
            </p>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{total}</div>
              <div className="text-xs text-gray-500 mt-1">Items Auditados</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${noCumplen > 0 ? 'text-red-600' : 'text-green-600'}`}>{noCumplen}</div>
              <div className="text-xs text-gray-500 mt-1">No Cumplen</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {pct}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Aprobación</div>
            </div>
          </div>

          {/* Items */}
          {secciones.map(sec => (
            <div key={sec.id} className="mb-4">
              <h2 className="text-sm font-bold text-gray-800 mb-2 border-b border-gray-200 pb-1">{sec.title}</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-1 pr-2 w-10">N°</th>
                    <th className="text-left py-1 pr-2">Item</th>
                    <th className="text-center py-1 w-24">Respuesta</th>
                    <th className="text-left py-1 w-40">Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {(sec.formulario_items ?? []).map(item => {
                    const r = respuestas.get(item.id)
                    const ansColor = r?.answer === 'cumple' ? 'text-green-700 bg-green-50'
                      : r?.answer === 'no_cumple' ? 'text-red-700 bg-red-50'
                      : r?.answer === 'no_aplica' ? 'text-gray-500 bg-gray-50'
                      : 'text-gray-300'
                    return (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2 text-gray-400 text-xs align-top">{item.numero_item ?? '-'}</td>
                        <td className="py-1.5 pr-2 text-gray-800">{item.question}</td>
                        <td className={`py-1.5 text-center text-xs font-medium rounded ${ansColor}`}>
                          {r?.answer ? ANSWER_LABELS[r.answer] : '—'}
                        </td>
                        <td className="py-1.5 pl-2 text-xs text-gray-400">{r?.comment ?? ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2 pb-4 sticky bottom-0 bg-white">
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setView('edit')} disabled={saving}>
              Seguir Editando
            </Button>
            <Button type="button" onClick={() => handleFinalizar(false)} disabled={saving}>
              {saving ? 'Guardando…' : 'Finalizar y Guardar Gestión'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleFinalizar(true)} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar y Descargar'}
            </Button>
          </div>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
