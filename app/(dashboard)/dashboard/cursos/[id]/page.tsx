'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useCurso, useCursoContenido, useProgresoCurso, useMisAsignaciones } from '@/lib/queries/curso'
import { PlayerSidebar } from '@/components/cursos/player-sidebar'
import { iniciarCurso } from '@/lib/actions/curso'
import { BookOpen } from 'lucide-react'

export default function CursoPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: curso } = useCurso(id)
  const { data: contenido } = useCursoContenido(id)
  const { data: asignaciones } = useMisAsignaciones()

  const asignacion = asignaciones?.find(a => (a as any).cursos?.id === id)
  const { data: progreso } = useProgresoCurso(asignacion?.id ?? '')

  const leccionesCompletadas = new Set(
    (progreso ?? []).filter(p => p.completada).map(p => p.leccion_id)
  )

  async function handleStart() {
    if (!asignacion?.id) return
    await iniciarCurso(asignacion.id)

    // Redirect to first leccion
    const firstModulo = contenido?.modulos?.[0]
    const firstLeccion = firstModulo?.lecciones?.[0]
    if (firstLeccion) {
      router.push(`/dashboard/cursos/${id}/leccion/${firstLeccion.id}`)
    }
  }

  if (!curso || !contenido) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-text-tertiary">Cargando curso...</p>
        </div>
      </div>
    )
  }

  const progresoPct = asignacion?.progreso_porcentaje ?? 0

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <PlayerSidebar
        cursoId={id}
        modulos={contenido.modulos}
        leccionesCompletadas={leccionesCompletadas}
        progreso={progresoPct}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-8">
          <div className="text-center space-y-4 py-12">
            <div className="w-20 h-20 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <BookOpen size={36} className="text-brand-primary" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary">{curso.titulo}</h1>
            {curso.descripcion_corta && (
              <p className="text-lg text-text-tertiary max-w-lg mx-auto">{curso.descripcion_corta}</p>
            )}
            {curso.descripcion_larga && (
              <p className="text-sm text-text-secondary max-w-xl mx-auto">{curso.descripcion_larga}</p>
            )}
          </div>

          {/* Info del curso */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
              <p className="text-2xl font-bold text-text-primary">{contenido.modulos.length}</p>
              <p className="text-xs text-text-tertiary">Módulos</p>
            </div>
            <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
              <p className="text-2xl font-bold text-text-primary">
                {contenido.modulos.reduce((acc, m) => acc + (m.lecciones?.length ?? 0), 0)}
              </p>
              <p className="text-xs text-text-tertiary">Lecciones</p>
            </div>
            <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
              <p className="text-2xl font-bold text-text-primary">{curso.duracion_estimada_minutos ?? '—'}</p>
              <p className="text-xs text-text-tertiary">Minutos</p>
            </div>
          </div>

          {/* Empezar / continuar */}
          {asignacion?.estado !== 'aprobado' && (
            <div className="text-center">
              <button
                onClick={handleStart}
                className="px-8 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-colors text-lg"
              >
                {asignacion?.estado === 'en_curso' ? 'Continuar curso' : 'Empezar curso'}
              </button>
            </div>
          )}

          {asignacion?.estado === 'aprobado' && (
            <div className="text-center space-y-3">
              <p className="text-green-600 font-semibold">✓ Curso aprobado</p>
              <button
                onClick={() => router.push(`/dashboard/cursos/${id}/certificado`)}
                className="px-6 py-2.5 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Ver certificado
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
