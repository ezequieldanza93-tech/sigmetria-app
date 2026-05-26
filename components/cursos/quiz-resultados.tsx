'use client'

import { Check, X } from 'lucide-react'
import type { CursoPregunta } from '@/lib/types'

interface QuizResultadosProps {
  preguntas: CursoPregunta[]
  respuestas: { pregunta_id: string; opciones_seleccionadas?: string[]; texto?: string; es_correcta: boolean }[]
  mostrarCorrectas: boolean
}

export function QuizResultados({ preguntas, respuestas, mostrarCorrectas }: QuizResultadosProps) {
  if (!mostrarCorrectas) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-text-primary">Revisión de respuestas</h3>
      {preguntas.map((p) => {
        const resp = respuestas.find(r => r.pregunta_id === p.id)

        return (
          <div key={p.id} className={`p-4 rounded-xl border ${
            resp?.es_correcta
              ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10'
              : 'border-red-200 bg-red-50/50 dark:bg-red-900/10'
          }`}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 ${resp?.es_correcta ? 'text-success' : 'text-danger'}`}>
                {resp?.es_correcta ? <Check size={18} /> : <X size={18} />}
              </span>
              <div className="flex-1">
                <p className="font-medium text-text-primary">{p.enunciado}</p>

                {p.opciones?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {p.opciones.map(o => {
                      const selected = resp?.opciones_seleccionadas?.includes(o.id)
                      return (
                        <div key={o.id} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                          o.es_correcta
                            ? 'bg-success-bg dark:bg-green-900/30 text-success dark:text-green-300'
                            : selected
                            ? 'bg-danger-bg dark:bg-red-900/30 text-danger dark:text-red-300'
                            : 'text-text-tertiary'
                        }`}>
                          {o.es_correcta && <Check size={14} />}
                          {selected && !o.es_correcta && <X size={14} />}
                          {o.texto}
                        </div>
                      )
                    })}
                  </div>
                )}

                {p.explicacion && (
                  <p className="mt-2 text-sm text-text-tertiary italic">{p.explicacion}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
