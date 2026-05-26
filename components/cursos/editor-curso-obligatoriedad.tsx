'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { definirObligatoriedad, eliminarObligatoriedad, reconciliarObligatoriedades } from '@/lib/actions/curso'

interface ReglaObligatoria {
  id: string
  scope_tipo: string
  scope_id: string
  vigente_desde: string
  vigente_hasta: string | null
  fecha_limite_dias: number | null
}

interface EditorObligatoriedadProps {
  cursoId: string
  reglas: ReglaObligatoria[]
  onRefresh: () => void
}

export function EditorObligatoriedad({ cursoId, reglas, onRefresh }: EditorObligatoriedadProps) {
  const toast = useToast()
  const [reconciling, setReconciling] = useState(false)

  async function handleCrearRegla(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('curso_id', cursoId)
    const res = await definirObligatoriedad(null, fd)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Regla creada')
    onRefresh()
    e.currentTarget.reset()
  }

  async function handleEliminarRegla(id: string) {
    if (!confirm('¿Eliminar esta regla de obligatoriedad?')) return
    const res = await eliminarObligatoriedad(id)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Regla eliminada')
    onRefresh()
  }

  async function handleReconciliar() {
    setReconciling(true)
    try {
      const res = await reconciliarObligatoriedades(cursoId)
      if (!res.success) { toast.error(res.error); return }
      toast.success(`${res.data.asignacionesNuevas} nuevas asignaciones creadas`)
      onRefresh()
    } finally {
      setReconciling(false)
    }
  }

  const scopeLabels: Record<string, string> = {
    empresa: 'Empresa',
    establecimiento: 'Establecimiento',
    sector: 'Sector',
    puesto: 'Puesto',
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Nueva regla de obligatoriedad</h4>
        <form onSubmit={handleCrearRegla} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Tipo de scope</label>
            <select name="scope_tipo" required className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-sm text-text-primary">
              <option value="empresa">Empresa</option>
              <option value="establecimiento">Establecimiento</option>
              <option value="sector">Sector</option>
              <option value="puesto">Puesto</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">ID del scope</label>
            <input name="scope_id" placeholder="UUID" required className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Vigente desde</label>
            <input name="vigente_desde" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Días para fecha límite</label>
            <input name="fecha_limite_dias" type="number" placeholder="Ej: 30" className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors">
              <Plus size={16} /> Agregar regla
            </button>
          </div>
        </form>
      </div>

      {/* Reglas existentes */}
      {reglas.length > 0 && (
        <div className="space-y-2">
          {reglas.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 bg-surface-elevated border border-border-subtle rounded-lg">
              <span className="text-sm font-medium text-text-primary">{scopeLabels[r.scope_tipo]}</span>
              <span className="text-xs font-mono text-text-tertiary">{r.scope_id.slice(0, 8)}...</span>
              <span className="text-xs text-text-tertiary">Desde: {r.vigente_desde}</span>
              {r.fecha_limite_dias && <span className="text-xs text-text-tertiary">{r.fecha_limite_dias} días límite</span>}
              <button onClick={() => handleEliminarRegla(r.id)} className="ml-auto p-1 text-text-tertiary hover:text-danger transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleReconciliar}
        disabled={reconciling}
        className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        {reconciling ? 'Reconciliando...' : 'Reconciliar asignaciones ahora'}
      </button>
    </div>
  )
}
