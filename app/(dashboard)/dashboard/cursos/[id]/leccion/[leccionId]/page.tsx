'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { useCursoContenido, useMisAsignaciones, useProgresoCurso } from '@/lib/queries/curso'
import { marcarLeccionCompletada } from '@/lib/actions/curso'
import { LeccionRenderer } from '@/components/cursos/leccion-renderer'
import { PlayerSidebar } from '@/components/cursos/player-sidebar'
import { useToast } from '@/lib/hooks/use-toast'

export default function LeccionPage({ params }: { params: Promise<{ id: string; leccionId: string }> }) {
  const { id: cursoId, leccionId } = use(params)
  const router = useRouter()
  const toast = useToast()
  const [completando, setCompletando] = useState(false)

  const { data: contenido } = useCursoContenido(cursoId)
  const { data: asignaciones } = useMisAsignaciones()
  const asignacion = asignaciones?.find(a => (a as any).cursos?.id === cursoId)
  const { data: progreso } = useProgresoCurso(asignacion?.id ?? '')

  // Find current leccion and its position
  let currentLeccion: any = null
  let prevLeccion: any = null
  let nextLeccion: any = null
  let currentModulo: any = null

  for (const modulo of contenido?.modulos ?? []) {
    for (let i = 0; i < (modulo.lecciones?.length ?? 0); i++) {
      if (modulo.lecciones[i].id === leccionId) {
        currentLeccion = modulo.lecciones[i]
        currentModulo = modulo
        prevLeccion = i > 0 ? modulo.lecciones[i - 1] : null
        nextLeccion = i < modulo.lecciones.length - 1 ? modulo.lecciones[i + 1] : null
        break
      }
    }
    if (currentLeccion) break
  }

  // If no next leccion in this module, find first leccion of next module
  if (!nextLeccion && currentModulo && contenido?.modulos) {
    const currentIdx = contenido.modulos.findIndex(m => m.id === currentModulo.id)
    if (currentIdx >= 0 && currentIdx < contenido.modulos.length - 1) {
      const nextMod = contenido.modulos[currentIdx + 1]
      if (nextMod.lecciones?.[0]) nextLeccion = nextMod.lecciones[0]
    }
  }

  const leccionesCompletadas = new Set(
    (progreso ?? []).filter(p => p.completada).map(p => p.leccion_id)
  )

  if (!contenido || !currentLeccion) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)]">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  async function handleCompletar() {
    if (!asignacion?.id) return
    setCompletando(true)
    try {
      const res = await marcarLeccionCompletada(asignacion.id, leccionId)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Lección completada')

      // Check if this module has a quiz — if so, redirect
      if (currentModulo?.quiz) {
        router.push(`/dashboard/cursos/${cursoId}/quiz/${currentModulo.quiz.id}`)
        return
      }

      // Navigate next
      if (nextLeccion) {
        router.push(`/dashboard/cursos/${cursoId}/leccion/${nextLeccion.id}`)
      } else {
        router.push(`/dashboard/cursos/${cursoId}`)
      }
    } finally {
      setCompletando(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <PlayerSidebar
        cursoId={cursoId}
        modulos={contenido.modulos}
        leccionesCompletadas={leccionesCompletadas}
        progreso={asignacion?.progreso_porcentaje ?? 0}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          {/* Header */}
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider">
              {currentModulo?.titulo}
            </p>
            <h1 className="text-2xl font-bold text-text-primary mt-1">{currentLeccion.titulo}</h1>
          </div>

          {/* Content */}
          <LeccionRenderer leccion={currentLeccion} />

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div>
              {prevLeccion && (
                <button
                  onClick={() => router.push(`/dashboard/cursos/${cursoId}/leccion/${prevLeccion.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
              )}
            </div>

            <button
              onClick={handleCompletar}
              disabled={completando}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle size={18} />
              {completando ? 'Guardando...' : 'Marcar como completada'}
            </button>

            <div>
              {nextLeccion && (
                <button
                  onClick={() => router.push(`/dashboard/cursos/${cursoId}/leccion/${nextLeccion.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                >
                  Siguiente
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
