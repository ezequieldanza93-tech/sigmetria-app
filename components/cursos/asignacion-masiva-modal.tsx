'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { asignarMasivo } from '@/lib/actions/curso'

interface AsignacionMasivaModalProps {
  cursoId: string
  onClose: () => void
  onSuccess: () => void
}

export function AsignacionMasivaModal({ cursoId, onClose, onSuccess }: AsignacionMasivaModalProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      const criterios: Record<string, string> = {}
      for (const [key, val] of fd.entries()) {
        if (val) criterios[key] = val as string
      }
      const res = await asignarMasivo(cursoId, criterios)
      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success(`${res.data.creadas} asignaciones creadas`)
        onSuccess()
      }
    } catch {
      toast.error('Error al asignar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface-elevated rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Asignar por criterios</h3>
          <button onClick={onClose} className="p-1 text-text-tertiary hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Empresa ID</label>
            <input name="empresa_id" placeholder="UUID de la empresa" className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Establecimiento ID</label>
            <input name="establecimiento_id" placeholder="UUID del establecimiento" className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Sector ID</label>
            <input name="sector_id" placeholder="UUID del sector" className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Puesto ID</label>
            <input name="puesto_id" placeholder="UUID del puesto" className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Fecha límite</label>
            <input name="fecha_limite" type="date" className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input name="obligatorio" type="checkbox" value="true" className="accent-brand-primary" />
            Obligatorio
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors">
              {submitting ? 'Asignando...' : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
