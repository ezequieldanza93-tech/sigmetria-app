'use client'

import { use } from 'react'
import { useCursoContenido, useMisAsignaciones } from '@/lib/queries/curso'
import { QuizPlayer } from '@/components/cursos/quiz-player'
import { AlertTriangle } from 'lucide-react'

export default function QuizPage({ params }: { params: Promise<{ id: string; quizId: string }> }) {
  const { id: cursoId, quizId } = use(params)
  const { data: contenido } = useCursoContenido(cursoId)
  const { data: asignaciones } = useMisAsignaciones()
  const asignacion = asignaciones?.find(a => (a as any).cursos?.id === cursoId)

  // Find quiz in modulos or final
  let quiz: any = null
  for (const modulo of contenido?.modulos ?? []) {
    if (modulo.quiz?.id === quizId) {
      quiz = modulo.quiz
      break
    }
  }
  if (!quiz && contenido?.quizFinal?.id === quizId) {
    quiz = contenido.quizFinal
  }

  if (!contenido || !asignacion) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertTriangle size={32} className="mx-auto text-amber-500" />
          <p className="text-text-tertiary">Quiz no encontrado</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <QuizPlayer
        quiz={quiz}
        cursoId={cursoId}
        intentoId="new"
        numeroIntento={1}
        maxIntentos={quiz.max_intentos}
      />
    </div>
  )
}
