'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { SearchableSelect } from '@/components/ui/searchable-select'
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

interface Opt { value: string; label: string }

const scopeLabels: Record<string, string> = {
  empresa: 'Empresa',
  establecimiento: 'Establecimiento',
  sector: 'Sector',
  puesto: 'Puesto',
}

const tableMap: Record<string, string> = {
  empresa: 'empresas',
  establecimiento: 'establecimientos',
  sector: 'establecimientos_sectores',
  puesto: 'puestos_de_trabajo',
}

export function EditorObligatoriedad({ cursoId, reglas, onRefresh }: EditorObligatoriedadProps) {
  const toast = useToast()
  const [reconciling, setReconciling] = useState(false)
  const [scopeTipo, setScopeTipo] = useState('empresa')
  const [scopeId, setScopeId] = useState('')
  const [scopeOpts, setScopeOpts] = useState<Opt[]>([])

  useEffect(() => {
    setScopeId('')
    setScopeOpts([])
    const supabase = createClient()
    const table = tableMap[scopeTipo]
    if (!table) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from(table as any).select('id, nombre').order('nombre').then(({ data }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setScopeOpts((data ?? []).map((r: any) => ({ value: r.id, label: r.nombre })))
    })
  }, [scopeTipo])

  async function handleCrearRegla(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!scopeId) { toast.error('Seleccioná un elemento del scope'); return }
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('curso_id', cursoId)
    fd.set('scope_tipo', scopeTipo)
    fd.set('scope_id', scopeId)
    const res = await definirObligatoriedad(null, fd)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Regla creada')
    onRefresh()
    form.reset()
    setScopeId('')
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

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary'

  return (
    <div className="space-y-6">
      <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Nueva regla de obligatoriedad</h4>
        <form onSubmit={handleCrearRegla} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Tipo de scope</label>
            <select
              value={scopeTipo}
              onChange={e => setScopeTipo(e.target.value)}
              className={inputCls}
            >
              <option value="empresa">Empresa</option>
              <option value="establecimiento">Establecimiento</option>
              <option value="sector">Sector</option>
              <option value="puesto">Puesto</option>
            </select>
          </div>
          <div>
            <SearchableSelect
              label={scopeLabels[scopeTipo]}
              options={scopeOpts}
              value={scopeId}
              onChange={setScopeId}
              placeholder={scopeOpts.length ? `Elegí ${scopeLabels[scopeTipo].toLowerCase()}…` : 'Cargando…'}
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Vigente desde</label>
            <input name="vigente_desde" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Días para fecha límite</label>
            <input name="fecha_limite_dias" type="number" placeholder="Ej: 30" className={inputCls} />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors">
              <Plus size={16} /> Agregar regla
            </button>
          </div>
        </form>
      </div>

      {reglas.length > 0 && (
        <div className="space-y-2">
          {reglas.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 bg-surface-elevated border border-border-subtle rounded-lg">
              <span className="text-sm font-medium text-text-primary">{scopeLabels[r.scope_tipo]}</span>
              <span className="text-xs font-mono text-text-tertiary">{r.scope_id.slice(0, 8)}…</span>
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
