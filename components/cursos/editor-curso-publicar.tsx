'use client'

import { useState } from 'react'
import { CheckCircle, Circle, AlertTriangle } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { publicarCurso, archivarCurso } from '@/lib/actions/curso'
import type { Curso, CursoModulo } from '@/lib/types'

interface EditorPublicarProps {
  curso: Curso
  modulos: CursoModulo[]
  quizFinal: any
}

export function EditorPublicar({ curso, modulos, quizFinal }: EditorPublicarProps) {
  const toast = useToast()
  const router = useRouter()
  const [publishing, setPublishing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const totalLecciones = modulos.reduce((acc, m) => acc + (m.lecciones?.length ?? 0), 0)
  const totalQuizzes = modulos.filter(m => m.quiz).length + (quizFinal ? 1 : 0)

  const checklist = [
    { label: 'Título del curso', ok: !!curso.titulo?.trim() },
    { label: 'Descripción corta', ok: !!curso.descripcion_corta?.trim() },
    { label: 'Portada del curso', ok: !!curso.portada_url },
    { label: 'Al menos 1 módulo', ok: modulos.length >= 1 },
    { label: 'Al menos 1 lección', ok: totalLecciones >= 1 },
    { label: 'Al menos 1 quiz (módulo o final)', ok: totalQuizzes >= 1 },
    { label: 'Vencimiento configurado', ok: curso.vencimiento_meses != null },
  ]

  const allOk = checklist.every(c => c.ok)

  async function handlePublicar() {
    setPublishing(true)
    try {
      const res = await publicarCurso(curso.id)
      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success('Curso publicado con éxito')
        router.refresh()
      }
    } catch {
      toast.error('Error al publicar')
    } finally {
      setPublishing(false)
    }
  }

  async function handleArchivar() {
    if (!confirm('¿Archivar este curso? Las asignaciones activas seguirán funcionando.')) return
    setArchiving(true)
    try {
      const res = await archivarCurso(curso.id)
      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success('Curso archivado')
        router.push('/dashboard/cursos/admin')
      }
    } catch {
      toast.error('Error al archivar')
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      {/* Checklist */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">Checklist de publicación</h3>
        {checklist.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            {item.ok ? (
              <CheckCircle size={20} className="text-success shrink-0" />
            ) : (
              <Circle size={20} className="text-text-tertiary/50 shrink-0" />
            )}
            <span className={`text-sm ${item.ok ? 'text-text-secondary' : 'text-text-tertiary'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
          <p className="text-2xl font-bold text-text-primary">{modulos.length}</p>
          <p className="text-xs text-text-tertiary">Módulos</p>
        </div>
        <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
          <p className="text-2xl font-bold text-text-primary">{totalLecciones}</p>
          <p className="text-xs text-text-tertiary">Lecciones</p>
        </div>
        <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
          <p className="text-2xl font-bold text-text-primary">{totalQuizzes}</p>
          <p className="text-xs text-text-tertiary">Quizzes</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {curso.estado === 'publicado' ? (
          <div className="p-4 bg-success-bg dark:bg-green-900/20 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle size={20} className="text-success shrink-0" />
            <span className="text-sm text-success dark:text-green-400">Este curso ya está publicado</span>
          </div>
        ) : allOk ? (
          <button
            onClick={handlePublicar}
            disabled={publishing}
            className="w-full py-3 bg-success text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {publishing ? 'Publicando...' : 'Publicar curso'}
          </button>
        ) : (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Faltan completar requisitos</p>
              <p className="text-xs text-amber-600/80 mt-1">Revisá el checklist de arriba para ver qué falta.</p>
            </div>
          </div>
        )}

        {curso.estado === 'publicado' && (
          <button
            onClick={handleArchivar}
            disabled={archiving}
            className="w-full py-2.5 border border-border-subtle text-text-secondary rounded-xl text-sm font-medium hover:bg-surface-sunken disabled:opacity-50 transition-colors"
          >
            {archiving ? 'Archivando...' : 'Archivar curso'}
          </button>
        )}
      </div>
    </div>
  )
}
