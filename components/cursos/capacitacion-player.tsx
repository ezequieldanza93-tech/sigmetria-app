'use client'

import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  CheckCircle,
  XCircle,
  Award,
  FileText,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeccionRenderer } from '@/components/cursos/leccion-renderer'
import { CapacitacionQuiz } from '@/components/cursos/capacitacion-quiz'
import type { CursoLeccion } from '@/lib/types'
import type {
  CapacitacionPublica,
  ResultadoEvaluacion,
} from '@/lib/actions/capacitacion'

interface CapacitacionPlayerProps {
  token: string
  data: CapacitacionPublica
}

type Fase = 'lecciones' | 'evaluacion' | 'resultado'

/**
 * Player público de la capacitación (sin login).
 *
 * Flujo:
 *  1) Slideshow de lecciones reusando LeccionRenderer (prev/next).
 *  2) Evaluación con CapacitacionQuiz (si el curso tiene quiz).
 *  3) Resultado: aprobado/puntaje + link al certificado si aplica.
 *
 * Si el participante ya estaba aprobado, arranca directo en el resultado.
 */
export function CapacitacionPlayer({ token, data }: CapacitacionPlayerProps) {
  const { curso, lecciones, quiz, participante } = data

  const yaAprobado = participante.aprobado
  const tieneEvaluacion = !!quiz && quiz.preguntas.length > 0

  const [fase, setFase] = useState<Fase>(yaAprobado ? 'resultado' : 'lecciones')
  const [leccionIdx, setLeccionIdx] = useState(0)
  const [resultado, setResultado] = useState<ResultadoEvaluacion | null>(
    yaAprobado
      ? { aprobado: true, puntaje: participante.puntaje ?? 100 }
      : null,
  )

  const leccionActual = lecciones[leccionIdx]
  const esUltimaLeccion = leccionIdx >= lecciones.length - 1
  const totalLecciones = lecciones.length

  function avanzarLeccion() {
    if (!esUltimaLeccion) {
      setLeccionIdx((i) => i + 1)
      return
    }
    // Fin del slideshow → evaluación o resultado directo si no hay quiz.
    setFase(tieneEvaluacion ? 'evaluacion' : 'resultado')
    if (!tieneEvaluacion) {
      // Sin quiz no hay aprobación automática acá; mostramos un cierre simple.
      setResultado({ aprobado: false, puntaje: 0 })
    }
  }

  // ── RESULTADO ──────────────────────────────────────────────
  if (fase === 'resultado' && resultado) {
    const aprobado = resultado.aprobado
    const codigo = resultado.certificadoCodigo

    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div
          className={`p-8 rounded-2xl text-center space-y-5 border ${
            aprobado
              ? 'bg-success-bg border-success/40'
              : 'bg-surface-elevated border-border-subtle'
          }`}
        >
          <div className="flex justify-center">
            {aprobado ? (
              <CheckCircle className="h-14 w-14 text-success" aria-hidden="true" />
            ) : tieneEvaluacion ? (
              <XCircle className="h-14 w-14 text-danger" aria-hidden="true" />
            ) : (
              <CheckCircle className="h-14 w-14 text-brand-primary" aria-hidden="true" />
            )}
          </div>

          {aprobado ? (
            <>
              <h2 className="text-2xl font-bold text-success">¡Capacitación aprobada!</h2>
              {tieneEvaluacion && (
                <p className="text-lg text-text-primary">Puntaje: {Math.round(resultado.puntaje)}%</p>
              )}
              <p className="text-sm text-text-secondary">
                Completaste la capacitación <span className="font-medium">{curso.titulo}</span>.
              </p>

              {codigo && (
                <div className="pt-3 flex flex-col items-center gap-3">
                  <a
                    href={`/api/cursos/certificado-pdf/${codigo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-hover text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
                  >
                    <FileText size={16} />
                    Descargar certificado
                  </a>
                  <a
                    href={`/verificar-certificado/${codigo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Award size={14} />
                    Verificar certificado
                  </a>
                </div>
              )}
            </>
          ) : tieneEvaluacion ? (
            <>
              <h2 className="text-2xl font-bold text-danger">No alcanzaste el mínimo</h2>
              <p className="text-lg text-text-primary">Puntaje: {Math.round(resultado.puntaje)}%</p>
              <p className="text-sm text-text-secondary">
                Podés repasar el contenido y volver a rendir la evaluación.
              </p>
              <div className="pt-3 flex flex-col items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setResultado(null)
                    setLeccionIdx(0)
                    setFase('lecciones')
                  }}
                >
                  <BookOpen size={16} />
                  Repasar y reintentar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setResultado(null)
                    setFase('evaluacion')
                  }}
                >
                  Reintentar evaluación
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-text-primary">¡Contenido completado!</h2>
              <p className="text-sm text-text-secondary">
                Terminaste de ver <span className="font-medium">{curso.titulo}</span>.
                Esta capacitación no requiere evaluación.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── EVALUACIÓN ─────────────────────────────────────────────
  if (fase === 'evaluacion' && quiz) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <CapacitacionQuiz
          token={token}
          preguntas={quiz.preguntas}
          porcentajeAprobacion={quiz.porcentaje_aprobacion}
          onResultado={(r) => {
            setResultado(r)
            setFase('resultado')
          }}
        />
      </div>
    )
  }

  // ── LECCIONES (slideshow) ──────────────────────────────────
  if (totalLecciones === 0) {
    // Curso sin lecciones: pasamos directo a evaluación si hay, si no a resultado.
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center space-y-4">
        <BookOpen className="h-10 w-10 text-text-tertiary mx-auto" aria-hidden="true" />
        <p className="text-text-secondary text-sm">Esta capacitación no tiene material cargado.</p>
        {tieneEvaluacion && (
          <Button type="button" onClick={() => setFase('evaluacion')}>
            Ir a la evaluación
            <ChevronRight size={16} />
          </Button>
        )}
      </div>
    )
  }

  // LeccionRenderer espera CursoLeccion (created_at/updated_at). La lección
  // pública no los trae; los completamos con valores vacíos solo para satisfacer
  // el tipo — el renderer no los usa.
  const leccionParaRenderer: CursoLeccion = {
    ...leccionActual,
    created_at: '',
    updated_at: '',
  }

  const progreso = Math.round(((leccionIdx + 1) / totalLecciones) * 100)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Progreso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 text-text-secondary">
            <GraduationCap size={16} className="text-brand-primary" />
            {curso.titulo}
          </span>
          <span className="text-text-tertiary">
            Lección {leccionIdx + 1} de {totalLecciones}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-primary transition-all duration-300"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </div>

      {/* Lección actual */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">{leccionActual.titulo}</h2>
        <LeccionRenderer leccion={leccionParaRenderer} />
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setLeccionIdx((i) => Math.max(0, i - 1))}
          disabled={leccionIdx === 0}
        >
          <ChevronLeft size={16} />
          Anterior
        </Button>

        <Button type="button" onClick={avanzarLeccion}>
          {esUltimaLeccion
            ? tieneEvaluacion
              ? 'Ir a la evaluación'
              : 'Finalizar'
            : 'Siguiente'}
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}
