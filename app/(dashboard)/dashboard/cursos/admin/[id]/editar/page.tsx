'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Info, Layers, ClipboardList, Users, AlertTriangle, Send, BookOpen } from 'lucide-react'
import { useCurso, useCursoContenido } from '@/lib/queries/curso'
import { EditorCursoInfo } from '@/components/cursos/editor-curso-info'
import { EditorCursoContenido } from '@/components/cursos/editor-curso-contenido'
import { EditorCursoQuizzes } from '@/components/cursos/editor-curso-quizzes'
import { EditorAsignacionMasiva } from '@/components/cursos/editor-curso-asignacion-masiva'
import { EditorObligatoriedad } from '@/components/cursos/editor-curso-obligatoriedad'
import { EditorPublicar } from '@/components/cursos/editor-curso-publicar'
import type { CursoModulo } from '@/lib/types'

const tabs = [
  { id: 'info', label: 'Información', icon: Info },
  { id: 'contenido', label: 'Contenido', icon: Layers },
  { id: 'quizzes', label: 'Quizzes', icon: ClipboardList },
  { id: 'asignaciones', label: 'Asignación', icon: Users },
  { id: 'obligatoriedad', label: 'Obligatoriedad', icon: AlertTriangle },
  { id: 'publicar', label: 'Publicar', icon: Send },
]

export default function EditarCursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tab, setTab] = useState('info')
  const { data: curso, refetch: refetchCurso } = useCurso(id)
  const { data: contenido, refetch: refetchContenido } = useCursoContenido(id)

  if (!curso) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const modulos: CursoModulo[] = contenido?.modulos ?? []

  function handleRefresh() {
    refetchCurso()
    refetchContenido()
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/cursos/admin"
          className="p-2 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{curso.titulo}</h1>
          <p className="text-sm text-text-tertiary capitalize">Editor de curso · Estado: {curso.estado}</p>
        </div>
        <Link
          href={`/dashboard/cursos/admin/${id}/asignaciones`}
          className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary border border-border-subtle rounded-lg hover:bg-surface-sunken transition-colors"
        >
          <BookOpen size={16} />
          Asignaciones
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-elevated border border-border-subtle rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-brand-primary text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-sunken'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'info' && <EditorCursoInfo curso={curso} />}
        {tab === 'contenido' && (
          <EditorCursoContenido
            cursoId={id}
            modulos={modulos}
            onRefresh={handleRefresh}
          />
        )}
        {tab === 'quizzes' && (
          <EditorCursoQuizzes
            cursoId={id}
            modulos={modulos}
            quizFinal={contenido?.quizFinal ?? null}
            onRefresh={handleRefresh}
          />
        )}
        {tab === 'asignaciones' && (
          <EditorAsignacionMasiva cursoId={id} onRefresh={handleRefresh} />
        )}
        {tab === 'obligatoriedad' && (
          <EditorObligatoriedad
            cursoId={id}
            reglas={[]}
            onRefresh={handleRefresh}
          />
        )}
        {tab === 'publicar' && (
          <EditorPublicar
            curso={curso}
            modulos={modulos}
            quizFinal={contenido?.quizFinal ?? null}
          />
        )}
      </div>
    </div>
  )
}
