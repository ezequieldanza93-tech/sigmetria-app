'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { submitEvaluacionPorToken } from '@/lib/actions/capacitacion'
import type {
  PreguntaPublica,
  RespuestaParticipante,
  ResultadoEvaluacion,
} from '@/lib/actions/capacitacion'

interface CapacitacionQuizProps {
  token: string
  preguntas: PreguntaPublica[]
  porcentajeAprobacion: number
  onResultado: (resultado: ResultadoEvaluacion) => void
}

interface RespuestaLocal {
  pregunta_id: string
  opciones_seleccionadas: string[]
  texto: string
}

/**
 * Quiz público liviano para el flujo de capacitación por token.
 *
 * A diferencia de QuizPlayer (acoplado a auth + enviarIntentoQuiz + rutas
 * /dashboard), este componente:
 *  - Recibe PreguntaPublica (SIN es_correcta — la corrección es server-side).
 *  - No depende de useToast / Toaster (no existe provider en la ruta pública).
 *  - Llama submitEvaluacionPorToken(token, respuestas) y delega el resultado
 *    al padre, que decide cómo mostrar aprobado/puntaje/certificado.
 */
export function CapacitacionQuiz({
  token,
  preguntas,
  porcentajeAprobacion,
  onResultado,
}: CapacitacionQuizProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaLocal>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preguntaActual = preguntas[currentIdx]
  const respuestaActual = preguntaActual ? respuestas[preguntaActual.id] : undefined

  const handleOptionSelect = useCallback(
    (pregunta: PreguntaPublica, opcionId: string) => {
      setRespuestas((prev) => {
        const actual = prev[pregunta.id]
        if (pregunta.tipo === 'multiple_choice' || pregunta.tipo === 'true_false') {
          return {
            ...prev,
            [pregunta.id]: { pregunta_id: pregunta.id, opciones_seleccionadas: [opcionId], texto: '' },
          }
        }
        // multiple_select
        const selected = actual?.opciones_seleccionadas ?? []
        const newSelected = selected.includes(opcionId)
          ? selected.filter((id) => id !== opcionId)
          : [...selected, opcionId]
        return {
          ...prev,
          [pregunta.id]: { pregunta_id: pregunta.id, opciones_seleccionadas: newSelected, texto: '' },
        }
      })
    },
    [],
  )

  const handleTextChange = useCallback((preguntaId: string, texto: string) => {
    setRespuestas((prev) => ({
      ...prev,
      [preguntaId]: { pregunta_id: preguntaId, opciones_seleccionadas: [], texto },
    }))
  }, [])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload: RespuestaParticipante[] = preguntas.map((p) => {
        const r = respuestas[p.id]
        return {
          pregunta_id: p.id,
          opciones_seleccionadas: r?.opciones_seleccionadas ?? [],
          texto: r?.texto ?? null,
        }
      })

      const res = await submitEvaluacionPorToken(token, payload)
      if (!res.success) {
        setError(res.error)
        return
      }
      onResultado(res.data)
    } catch {
      setError('No se pudo enviar la evaluación. Reintentá en unos segundos.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!preguntaActual) {
    return (
      <div className="flex items-center justify-center h-48 text-text-tertiary">
        Esta evaluación no tiene preguntas configuradas.
      </div>
    )
  }

  const esUltima = currentIdx === preguntas.length - 1
  const radioMode =
    preguntaActual.tipo === 'multiple_choice' || preguntaActual.tipo === 'true_false'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Evaluación</h2>
          <p className="text-sm text-text-tertiary">Mínimo para aprobar: {porcentajeAprobacion}%</p>
        </div>
        <span className="text-sm text-text-tertiary">
          {currentIdx + 1} / {preguntas.length}
        </span>
      </div>

      {/* Pregunta actual */}
      <div className="p-6 bg-surface-elevated border border-border-subtle rounded-xl space-y-4">
        <h3 className="text-base font-medium text-text-primary">{preguntaActual.enunciado}</h3>

        {preguntaActual.tipo === 'short_text' ? (
          <input
            type="text"
            placeholder="Escribí tu respuesta..."
            value={respuestaActual?.texto ?? ''}
            onChange={(e) => handleTextChange(preguntaActual.id, e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border-subtle bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        ) : (
          <div className="space-y-2">
            {preguntaActual.opciones.map((opcion) => {
              const isSelected = respuestaActual?.opciones_seleccionadas?.includes(opcion.id)
              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => handleOptionSelect(preguntaActual, opcion.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-all ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-border-subtle text-text-secondary hover:border-text-tertiary hover:bg-surface-sunken'
                  }`}
                >
                  <span
                    className={`w-5 h-5 ${radioMode ? 'rounded-full' : 'rounded'} border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-brand-primary' : 'border-text-tertiary'
                    }`}
                  >
                    {isSelected && (
                      <span
                        className={`w-2.5 h-2.5 ${radioMode ? 'rounded-full' : 'rounded-sm'} bg-brand-primary`}
                      />
                    )}
                  </span>
                  {opcion.texto}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger text-center" role="alert">
          {error}
        </p>
      )}

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0 || submitting}
        >
          <ChevronLeft size={16} />
          Anterior
        </Button>

        {!esUltima ? (
          <Button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.min(preguntas.length - 1, i + 1))}
          >
            Siguiente
            <ChevronRight size={16} />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar evaluación'}
            <Send size={16} />
          </Button>
        )}
      </div>
    </div>
  )
}
