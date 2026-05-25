'use client'

import { useState } from 'react'
import { X, Upload, Sparkles } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'

interface AiPregunta {
  enunciado: string
  tipo: 'multiple_choice'
  opciones: { texto: string; es_correcta: boolean }[]
  explicacion: string
}

interface AiQuizModalProps {
  onAccept: (preguntas: AiPregunta[]) => void
  onClose: () => void
}

export function AiQuizModal({ onAccept, onClose }: AiQuizModalProps) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [numPreguntas, setNumPreguntas] = useState(10)
  const [loading, setLoading] = useState(false)
  const [preguntas, setPreguntas] = useState<AiPregunta[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  async function handleGenerate() {
    if (!file) {
      toast.error('Seleccioná un archivo PDF')
      return
    }

    setLoading(true)
    setPreguntas([])
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('num_preguntas', String(numPreguntas))

      const res = await fetch('/api/cursos/ai-quiz', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Error al generar preguntas')
        return
      }

      const data = await res.json()
      setPreguntas(data.preguntas)
      setSelected(new Set(data.preguntas.map((_: any, i: number) => i)))
    } catch {
      toast.error('Error de conexión al generar preguntas')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(idx: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) { next.delete(idx) } else { next.add(idx) }
      return next
    })
  }

  function handleAccept() {
    const selectedPreguntas = preguntas.filter((_, i) => selected.has(i))
    if (selectedPreguntas.length === 0) {
      toast.error('Seleccioná al menos 1 pregunta')
      return
    }
    onAccept(selectedPreguntas)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface-elevated rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Sparkles size={20} className="text-amber-500" />
            Generar preguntas con AI
          </h3>
          <button onClick={onClose} className="p-1 text-text-tertiary hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {preguntas.length === 0 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Subí un PDF con el material del curso para generar preguntas automáticamente.
              </label>
              <label className="flex items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-border-subtle rounded-xl cursor-pointer hover:border-brand-primary/50 transition-colors">
                <Upload size={24} className="text-text-tertiary" />
                <div>
                  <p className="text-sm font-medium text-text-secondary">
                    {file ? file.name : 'Hacé clic para seleccionar un PDF'}
                  </p>
                  {file && <p className="text-xs text-text-tertiary">{(file.size / 1024).toFixed(0)} KB</p>}
                </div>
                <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Cantidad de preguntas: {numPreguntas}
              </label>
              <input
                type="range"
                min={5}
                max={20}
                value={numPreguntas}
                onChange={e => setNumPreguntas(Number(e.target.value))}
                className="w-full accent-brand-primary"
              />
              <div className="flex justify-between text-xs text-text-tertiary">
                <span>5</span>
                <span>20</span>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !file}
              className="w-full py-3 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>Generando con Claude...</>
              ) : (
                <><Sparkles size={18} /> Generar preguntas</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Se generaron {preguntas.length} preguntas. Seleccioná las que querés agregar al quiz.
            </p>

            <div className="space-y-3">
              {preguntas.map((p, i) => (
                <div key={i} className={`p-4 border rounded-xl cursor-pointer transition-all ${
                  selected.has(i) ? 'border-brand-primary bg-brand-primary/5' : 'border-border-subtle'
                }`} onClick={() => toggleSelect(i)}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelect(i)}
                      className="mt-1 accent-brand-primary"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{p.enunciado}</p>
                      <div className="mt-2 space-y-1">
                        {p.opciones.map((o, oi) => (
                          <div key={oi} className={`text-sm px-2 py-1 rounded ${
                            o.es_correcta ? 'bg-green-50 dark:bg-green-900/20 text-green-700' : 'text-text-tertiary'
                          }`}>
                            {o.es_correcta && '✓ '}{o.texto}
                          </div>
                        ))}
                      </div>
                      {p.explicacion && (
                        <p className="mt-2 text-xs text-text-tertiary italic">{p.explicacion}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setPreguntas([]); setFile(null) }}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Regenerar
              </button>
              <button
                onClick={handleAccept}
                className="px-6 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Agregar {selected.size} pregunta(s) al quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
