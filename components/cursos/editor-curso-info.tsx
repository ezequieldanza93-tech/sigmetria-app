'use client'

import { useState } from 'react'
import { useToast } from '@/lib/hooks/use-toast'
import type { Curso } from '@/lib/types'
import { actualizarCurso } from '@/lib/actions/curso'

interface EditorCursoInfoProps {
  curso: Curso
}

export function EditorCursoInfo({ curso }: EditorCursoInfoProps) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      const res = await actualizarCurso(curso.id, null, formData)
      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success('Curso actualizado')
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1">Título *</label>
          <input
            name="titulo"
            defaultValue={curso.titulo}
            required
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1">Descripción corta</label>
          <input
            name="descripcion_corta"
            defaultValue={curso.descripcion_corta ?? ''}
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1">Descripción larga</label>
          <textarea
            name="descripcion_larga"
            defaultValue={curso.descripcion_larga ?? ''}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Categoría</label>
          <input
            name="categoria"
            defaultValue={curso.categoria ?? ''}
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Nivel</label>
          <select
            name="nivel"
            defaultValue={curso.nivel}
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="basico">Básico</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Idioma</label>
          <input
            name="idioma"
            defaultValue={curso.idioma}
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Duración estimada (minutos)</label>
          <input
            name="duracion_estimada_minutos"
            type="number"
            defaultValue={curso.duracion_estimada_minutos ?? ''}
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Vencimiento del certificado (meses)</label>
          <input
            name="vencimiento_meses"
            type="number"
            defaultValue={curso.vencimiento_meses ?? ''}
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Portada</label>
          <input
            name="portada"
            type="file"
            accept="image/*"
            className="w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-primary/10 file:text-brand-primary file:text-sm file:font-medium hover:file:bg-brand-primary/20"
          />
          <input type="hidden" name="portada_url" value={curso.portada_url ?? ''} />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
