'use client'

import { useState } from 'react'
import { useMisAsignaciones } from '@/lib/queries/curso'
import { CursoCard } from '@/components/cursos/curso-card'
import { EmptyState } from '@/components/ui/empty-state'

export default function MisCursosPage() {
  const [filtro, setFiltro] = useState<string>('todos')
  const { data: asignaciones, isLoading } = useMisAsignaciones()

  const filtrados = asignaciones?.filter(a => {
    if (filtro === 'todos') return true
    return a.estado === filtro
  }) ?? []

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mis cursos</h1>
          <p className="text-sm text-text-tertiary">Cursos asignados para capacitación</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'pendiente', label: 'Pendientes' },
          { key: 'en_curso', label: 'En curso' },
          { key: 'aprobado', label: 'Aprobados' },
          { key: 'vencido', label: 'Vencidos' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              filtro === f.key
                ? 'bg-brand-primary text-white'
                : 'bg-surface-elevated text-text-secondary hover:bg-surface-sunken'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-surface-elevated border border-border-subtle rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          title="No tenés cursos asignados"
          description="Cuando te asignen un curso, aparecerá acá."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(asig => (
            <CursoCard
              key={asig.id}
              curso={(asig as any).cursos}
              href={
                asig.estado === 'aprobado'
                  ? `/dashboard/cursos/${(asig as any).cursos?.id}/certificado`
                  : `/dashboard/cursos/${(asig as any).cursos?.id}`
              }
              progreso={asig.progreso_porcentaje}
              estadoAsignacion={asig.estado}
              fechaLimite={asig.fecha_limite}
            />
          ))}
        </div>
      )}
    </div>
  )
}
