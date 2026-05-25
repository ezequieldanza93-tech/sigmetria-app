'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import type { CursoQuiz } from '@/lib/types'
import { enviarIntentoQuiz } from '@/lib/actions/curso'

interface QuizPlayerProps {
  quiz: CursoQuiz
  cursoId: string
  intentoId: string
  numeroIntento: number
  maxIntentos: number | null
}

interface RespuestaUsuario {
  pregunta_id: string
  opciones_seleccionadas: string[]
  texto: string
}

export function QuizPlayer({ quiz, cursoId, intentoId, numeroIntento, maxIntentos }: QuizPlayerProps) {
  const router = useRouter()
  const toast = useToast()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaUsuario>>({})
  const [submitting, setSubmitting] = useState(false)
  const [resultado, setResultado] = useState<{ aprobado: boolean; puntaje: number; certificadoId?: string } | null>(null)

  const preguntas = quiz.preguntas ?? []
  const preguntaActual = preguntas[currentIdx]
  const respuestaActual = respuestas[preguntaActual?.id]

  const handleOptionSelect = useCallback((preguntaId: string, opcionId: string) => {
    setRespuestas(prev => {
      const actual = prev[preguntaId]
      if (preguntaActual?.tipo === 'multiple_choice' || preguntaActual?.tipo === 'true_false') {
        return { ...prev, [preguntaId]: { pregunta_id: preguntaId, opciones_seleccionadas: [opcionId], texto: '' } }
      }
      // multiple_select
      const selected = actual?.opciones_seleccionadas ?? []
      const newSelected = selected.includes(opcionId)
        ? selected.filter(id => id !== opcionId)
        : [...selected, opcionId]
      return { ...prev, [preguntaId]: { pregunta_id: preguntaId, opciones_seleccionadas: newSelected, texto: '' } }
    })
  }, [preguntaActual])

  const handleTextChange = useCallback((preguntaId: string, texto: string) => {
    setRespuestas(prev => ({
      ...prev,
      [preguntaId]: { pregunta_id: preguntaId, opciones_seleccionadas: [], texto },
    }))
  }, [])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('intento_id', intentoId)
      formData.set('respuestas', JSON.stringify(Object.values(respuestas)))

      const res = await enviarIntentoQuiz(null, formData)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setResultado(res.data)
    } catch {
      toast.error('Error al enviar el quiz')
    } finally {
      setSubmitting(false)
    }
  }

  if (resultado) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        <div className={`p-8 rounded-xl text-center space-y-4 ${
          resultado.aprobado ? 'bg-green-50 dark:bg-green-900/20 border border-green-200' : 'bg-red-50 dark:bg-red-900/20 border border-red-200'
        }`}>
          <h2 className={`text-2xl font-bold ${resultado.aprobado ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {resultado.aprobado ? '✓ ¡Aprobado!' : '✗ No aprobado'}
          </h2>
          <p className="text-lg">Puntaje: {Math.round(resultado.puntaje)}%</p>
          <p className="text-sm text-text-tertiary">
            Mínimo requerido: {quiz.porcentaje_aprobacion}%
          </p>

          <div className="pt-4 flex flex-col items-center gap-3">
            {resultado.aprobado ? (
              <>
                <p className="text-sm text-text-secondary">¡Felicitaciones! Completaste el quiz.</p>
                {resultado.certificadoId && (
                  <a
                    href={`/dashboard/cursos/${cursoId}/certificado`}
                    className="px-6 py-2.5 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 transition-colors"
                  >
                    Ver certificado
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">No alcanzaste el mínimo requerido.</p>
                {(!maxIntentos || numeroIntento < maxIntentos) ? (
                  <button
                    onClick={() => router.refresh()}
                    className="px-6 py-2.5 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 transition-colors"
                  >
                    Reintentar
                  </button>
                ) : (
                  <p className="text-sm text-red-600 font-medium">Alcanzaste el máximo de intentos.</p>
                )}
              </>
            )}

            <button
              onClick={() => router.push(`/dashboard/cursos/${cursoId}`)}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Volver al curso
            </button>
          </div>
        </div>

        {/* Show correct answers if configured */}
        {quiz.mostrar_correctas && (
          <div className="space-y-4">
            <h3 className="font-semibold text-text-primary">Respuestas correctas</h3>
            {preguntas.map((p) => {
              const resp = respuestas[p.id]

              return (
                <div key={p.id} className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
                  <p className="font-medium text-text-primary mb-2">{p.enunciado}</p>
                  {p.opciones?.map(o => (
                    <div key={o.id} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                      o.es_correcta ? 'bg-green-50 dark:bg-green-900/20 text-green-700' :
                      resp?.opciones_seleccionadas?.includes(o.id) ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : ''
                    }`}>
                      {o.es_correcta && <span className="text-green-600">✓</span>}
                      {!o.es_correcta && resp?.opciones_seleccionadas?.includes(o.id) && <span className="text-red-600">✗</span>}
                      {o.texto}
                    </div>
                  ))}
                  {p.explicacion && (
                    <p className="mt-2 text-sm text-text-tertiary italic">{p.explicacion}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (!preguntaActual) {
    return (
      <div className="flex items-center justify-center h-48 text-text-tertiary">
        Este quiz no tiene preguntas configuradas.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{quiz.titulo}</h2>
          <p className="text-sm text-text-tertiary">
            Intento {numeroIntento}{maxIntentos ? ` de ${maxIntentos}` : ''} · Mínimo {quiz.porcentaje_aprobacion}%
          </p>
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
            {preguntaActual.opciones?.map((opcion) => {
              const isSelected = respuestaActual?.opciones_seleccionadas?.includes(opcion.id)
              return (
                <button
                  key={opcion.id}
                  onClick={() => handleOptionSelect(preguntaActual.id, opcion.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-all ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-border-subtle text-text-secondary hover:border-text-tertiary hover:bg-surface-sunken'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-brand-primary' : 'border-text-tertiary'
                  }`}>
                    {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-brand-primary" />}
                  </span>
                  {opcion.texto}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          Anterior
        </button>

        {currentIdx < preguntas.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(i => Math.min(preguntas.length - 1, i + 1))}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
          >
            Siguiente
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Enviando...' : 'Enviar quiz'}
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
