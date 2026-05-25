'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { crearCurso } from '@/lib/actions/curso'

export default function NuevoCursoPage() {
  const router = useRouter()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      const res = await crearCurso(null, formData)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Curso creado')
      router.push(`/dashboard/cursos/admin/${res.data.id}/editar`)
    } catch {
      toast.error('Error al crear el curso')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nuevo curso</h1>
          <p className="text-sm text-text-tertiary">Completá los datos básicos para empezar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Título del curso *</label>
            <input
              name="titulo"
              required
              placeholder="Ej: Seguridad en Altura - Nivel Básico"
              className="w-full px-3 py-2.5 rounded-lg border border-border-subtle bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Descripción corta</label>
            <input
              name="descripcion_corta"
              placeholder="Breve descripción que aparece en la tarjeta del curso"
              className="w-full px-3 py-2.5 rounded-lg border border-border-subtle bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary"
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Nivel</label>
              <select name="nivel" className="w-full px-3 py-2.5 rounded-lg border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option value="basico">Básico</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Categoría</label>
              <input name="categoria" placeholder="Ej: Seguridad" className="w-full px-3 py-2.5 rounded-lg border border-border-subtle bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save size={18} />
            {saving ? 'Creando...' : 'Crear curso'}
          </button>
        </div>
      </form>
    </div>
  )
}
