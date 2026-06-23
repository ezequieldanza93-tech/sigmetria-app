'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { asignarMasivo } from '@/lib/actions/curso'
import { createClient } from '@/lib/supabase/client'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface AsignacionMasivaModalProps {
  cursoId: string
  onClose: () => void
  onSuccess: () => void
}

interface Opt { value: string; label: string }

export function AsignacionMasivaModal({ cursoId, onClose, onSuccess }: AsignacionMasivaModalProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [empresas, setEmpresas] = useState<Opt[]>([])
  const [establecimientos, setEstablecimientos] = useState<Opt[]>([])
  const [sectores, setSectores] = useState<Opt[]>([])
  const [puestos, setPuestos] = useState<Opt[]>([])

  const [empresaId, setEmpresaId] = useState('')
  const [establecimientoId, setEstablecimientoId] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [puestoId, setPuestoId] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [obligatorio, setObligatorio] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('empresas').select('id, nombre').order('nombre').then(({ data }) => {
      setEmpresas((data ?? []).map(e => ({ value: e.id, label: e.nombre })))
    })
  }, [])

  useEffect(() => {
    setEstablecimientoId('')
    setSectorId('')
    setPuestoId('')
    setEstablecimientos([])
    setSectores([])
    setPuestos([])
    if (!empresaId) return
    supabase.from('establecimientos').select('id, nombre').eq('empresa_id', empresaId).order('nombre').then(({ data }) => {
      setEstablecimientos((data ?? []).map(e => ({ value: e.id, label: e.nombre })))
    })
  }, [empresaId])

  useEffect(() => {
    setSectorId('')
    setPuestoId('')
    setSectores([])
    setPuestos([])
    if (!establecimientoId) return
    supabase.from('establecimientos_sectores').select('id, nombre').eq('establecimiento_id', establecimientoId).order('nombre').then(({ data }) => {
      setSectores((data ?? []).map(s => ({ value: s.id, label: s.nombre })))
    })
  }, [establecimientoId])

  useEffect(() => {
    setPuestoId('')
    setPuestos([])
    if (!sectorId) return
    supabase.from('puestos_de_trabajo').select('id, nombre').eq('sector_id', sectorId).order('nombre').then(({ data }) => {
      setPuestos((data ?? []).map(p => ({ value: p.id, label: p.nombre })))
    })
  }, [sectorId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const criterios: Record<string, string> = {}
      if (empresaId) criterios.empresa_id = empresaId
      if (establecimientoId) criterios.establecimiento_id = establecimientoId
      if (sectorId) criterios.sector_id = sectorId
      if (puestoId) criterios.puesto_id = puestoId
      if (fechaLimite) criterios.fecha_limite = fechaLimite
      if (obligatorio) criterios.obligatorio = 'true'

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

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface-elevated rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Asignar por criterios</h3>
          <button onClick={onClose} className="p-1 text-text-tertiary hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <SearchableSelect
            label="Empresa"
            options={empresas}
            value={empresaId}
            onChange={setEmpresaId}
            placeholder="Todas las empresas…"
          />
          <SearchableSelect
            label="Establecimiento"
            options={establecimientos}
            value={establecimientoId}
            onChange={setEstablecimientoId}
            placeholder={empresaId ? 'Todos los establecimientos…' : 'Elegí una empresa primero'}
            disabled={!empresaId}
          />
          <SearchableSelect
            label="Sector (opcional)"
            options={sectores}
            value={sectorId}
            onChange={setSectorId}
            placeholder={establecimientoId ? 'Todos los sectores…' : 'Elegí un establecimiento primero'}
            disabled={!establecimientoId}
          />
          <SearchableSelect
            label="Puesto (opcional)"
            options={puestos}
            value={puestoId}
            onChange={setPuestoId}
            placeholder={sectorId ? 'Todos los puestos…' : 'Elegí un sector primero'}
            disabled={!sectorId}
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Fecha límite</label>
            <input
              name="fecha_limite"
              type="date"
              value={fechaLimite}
              onChange={e => setFechaLimite(e.target.value)}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={obligatorio}
              onChange={e => setObligatorio(e.target.checked)}
              className="accent-brand-primary"
            />
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
