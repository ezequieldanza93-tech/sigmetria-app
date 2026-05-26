'use client'

import React, { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, FileText, Video, File, Code } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { crearModulo, eliminarModulo, crearLeccion, eliminarLeccion } from '@/lib/actions/curso'
import type { CursoModulo } from '@/lib/types'

interface EditorCursoContenidoProps {
  cursoId: string
  modulos: CursoModulo[]
  onRefresh: () => void
}

const tipoIcon = { video: Video, pdf: File, texto: FileText, embed: Code }
const tipoLabels: Record<string, string> = { video: 'Video', pdf: 'PDF', texto: 'Texto', embed: 'Embed' }

export function EditorCursoContenido({ cursoId, modulos, onRefresh }: EditorCursoContenidoProps) {
  const toast = useToast()
  const [expanded, setExpanded] = useState<Set<string>>(new Set(modulos.map(m => m.id)))

  async function handleCrearModulo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('curso_id', cursoId)
    const res = await crearModulo(null, fd)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Módulo creado')
    onRefresh()
    e.currentTarget.reset()
  }

  async function handleEliminarModulo(moduloId: string) {
    if (!confirm('¿Eliminar este módulo y todo su contenido?')) return
    const res = await eliminarModulo(moduloId)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Módulo eliminado')
    onRefresh()
  }

  async function handleCrearLeccion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('modulo_id', (e.currentTarget as HTMLFormElement).dataset.moduloId!)
    const res = await crearLeccion(null, fd)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Lección creada')
    onRefresh()
    e.currentTarget.reset()
  }

  async function handleEliminarLeccion(leccionId: string) {
    if (!confirm('¿Eliminar esta lección?')) return
    const res = await eliminarLeccion(leccionId)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Lección eliminada')
    onRefresh()
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Crear módulo */}
      <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Nuevo módulo</h4>
        <form onSubmit={handleCrearModulo} className="flex gap-2">
          <input
            name="titulo"
            placeholder="Título del módulo"
            required
            className="flex-1 px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors"
          >
            <Plus size={16} /> Agregar
          </button>
        </form>
      </div>

      {/* Lista de módulos */}
      {modulos.length === 0 && (
        <p className="text-sm text-text-tertiary text-center py-8">No hay módulos. Creá el primero arriba.</p>
      )}

      <div className="space-y-4">
        {modulos.map((modulo) => (
          <div key={modulo.id} className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
            {/* Módulo header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle bg-surface-sunken/50">
              <button onClick={() => toggleExpand(modulo.id)} className="text-text-tertiary hover:text-text-secondary">
                {expanded.has(modulo.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <GripVertical size={16} className="text-text-tertiary/50 cursor-grab" />
              <span className="text-sm font-semibold text-text-primary flex-1">{modulo.titulo}</span>
              <button
                onClick={() => handleEliminarModulo(modulo.id)}
                className="p-1 text-text-tertiary hover:text-danger transition-colors"
                title="Eliminar módulo"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {expanded.has(modulo.id) && (
              <div className="p-4 space-y-3">
                {/* Lecciones existentes */}
                {modulo.lecciones?.map((leccion, idx) => (
                  <div key={leccion.id} className="flex items-center gap-2 px-3 py-2 bg-surface-base rounded-lg border border-border-subtle">
                    <span className="text-lg" style={{ color: 'var(--text-tertiary)' }}>
                      {React.createElement(tipoIcon[leccion.tipo] || FileText, { size: 16 })}
                    </span>
                    <span className="flex-1 text-sm text-text-primary">{idx + 1}. {leccion.titulo}</span>
                    <span className="text-xs text-text-tertiary">{tipoLabels[leccion.tipo]}</span>
                    <button
                      onClick={() => handleEliminarLeccion(leccion.id)}
                      className="p-1 text-text-tertiary hover:text-danger transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* Crear lección form */}
                <form onSubmit={handleCrearLeccion} data-modulo-id={modulo.id} className="flex gap-2 pt-2">
                  <input
                    name="titulo"
                    placeholder="Título de la lección"
                    required
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <select
                    name="tipo"
                    className="px-2 py-1.5 rounded-lg border border-border-subtle bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="video">Video</option>
                    <option value="pdf">PDF</option>
                    <option value="texto">Texto</option>
                    <option value="embed">Embed</option>
                  </select>
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-primary text-white rounded-lg text-sm hover:bg-brand-primary/90 transition-colors"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}


