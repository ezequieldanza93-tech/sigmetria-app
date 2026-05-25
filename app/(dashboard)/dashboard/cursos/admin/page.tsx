'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, BookOpen, Library } from 'lucide-react'
import { useCursos } from '@/lib/queries/curso'
import { CursoCard } from '@/components/cursos/curso-card'
import { EmptyState } from '@/components/ui/empty-state'

export default function AdminCursosPage() {
  const [tab, setTab] = useState<'mis' | 'publicos'>('mis')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')

  const { data: cursos, isLoading } = useCursos({ tipo: tab === 'publicos' ? 'publicos' : undefined, estado: estadoFiltro })

  const filtrados = (cursos ?? []).filter(c => {
    if (estadoFiltro === 'todos') return true
    return c.estado === estadoFiltro
  })

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Administrar cursos</h1>
          <p className="text-sm text-text-tertiary">Creá y gestioná los cursos de capacitación</p>
        </div>
        <Link
          href="/dashboard/cursos/admin/nuevo"
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Plus size={18} />
          Nuevo curso
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-elevated border border-border-subtle rounded-xl w-fit">
        <button
          onClick={() => setTab('mis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'mis' ? 'bg-brand-primary text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <BookOpen size={16} />
          Mis cursos
        </button>
        <button
          onClick={() => setTab('publicos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'publicos' ? 'bg-brand-primary text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Library size={16} />
          Biblioteca Sigmetría
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {['todos', 'borrador', 'publicado', 'archivado'].map(est => (
          <button
            key={est}
            onClick={() => setEstadoFiltro(est)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              estadoFiltro === est
                ? 'bg-brand-primary text-white'
                : 'bg-surface-elevated text-text-secondary hover:bg-surface-sunken'
            }`}
          >
            {est === 'todos' ? 'Todos' : est.charAt(0).toUpperCase() + est.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-surface-elevated border border-border-subtle rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          title="No hay cursos"
          description={tab === 'mis' ? 'Creá tu primer curso para empezar.' : 'No hay cursos públicos en la biblioteca.'}
          action={tab === 'mis' ? { label: 'Crear curso', href: '/dashboard/cursos/admin/nuevo' } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(curso => (
            <CursoCard
              key={curso.id}
              curso={curso}
              href={`/dashboard/cursos/admin/${curso.id}/editar`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
