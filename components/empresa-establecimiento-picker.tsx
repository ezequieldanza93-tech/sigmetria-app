'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface EmpresaOption {
  id: string
  razon_social: string
}

interface EstablecimientoOption {
  id: string
  nombre: string
}

interface EmpresaEstablecimientoPickerProps {
  /** Si viene, se precarga esa empresa. Combinado con lockEmpresa la deja fija. */
  initialEmpresaId?: string | null
  /** Bloquea la empresa: solo se pide el establecimiento. */
  lockEmpresa?: boolean
  onPick: (empresaId: string, establecimientoId: string) => void
}

const selectCls =
  'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500 disabled:opacity-60 disabled:cursor-not-allowed'

/**
 * Selector en cascada Empresa → Establecimiento.
 * Carga empresas/establecimientos con el cliente browser; RLS filtra por
 * consultora y accesos del usuario.
 */
export function EmpresaEstablecimientoPicker({
  initialEmpresaId = null,
  lockEmpresa = false,
  onPick,
}: EmpresaEstablecimientoPickerProps) {
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([])
  const [lockedEmpresaNombre, setLockedEmpresaNombre] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string>(initialEmpresaId ?? '')
  const [establecimientos, setEstablecimientos] = useState<EstablecimientoOption[]>([])
  const [establecimientoId, setEstablecimientoId] = useState<string>('')
  const [loadingEmpresas, setLoadingEmpresas] = useState(!lockEmpresa)
  const [loadingEsts, setLoadingEsts] = useState(false)

  // Carga inicial: o bien la lista de empresas, o bien el nombre de la
  // empresa bloqueada.
  useEffect(() => {
    const supabase = createClient()
    if (lockEmpresa && initialEmpresaId) {
      supabase
        .from('empresas')
        .select('razon_social')
        .eq('id', initialEmpresaId)
        .maybeSingle()
        .then(({ data }) => setLockedEmpresaNombre(data?.razon_social ?? '—'))
      return
    }
    setLoadingEmpresas(true)
    supabase
      .from('empresas')
      .select('id, razon_social')
      .order('razon_social')
      .then(({ data }) => {
        setEmpresas((data ?? []) as EmpresaOption[])
        setLoadingEmpresas(false)
      })
  }, [lockEmpresa, initialEmpresaId])

  // Al elegir/precargar empresa, cargar sus establecimientos.
  useEffect(() => {
    if (!empresaId) {
      setEstablecimientos([])
      setEstablecimientoId('')
      return
    }
    const supabase = createClient()
    setLoadingEsts(true)
    setEstablecimientoId('')
    supabase
      .from('establecimientos')
      .select('id, nombre')
      .eq('empresa_id', empresaId)
      .order('nombre')
      .then(({ data }) => {
        setEstablecimientos((data ?? []) as EstablecimientoOption[])
        setLoadingEsts(false)
      })
  }, [empresaId])

  function handleContinue() {
    if (empresaId && establecimientoId) onPick(empresaId, establecimientoId)
  }

  return (
    <div className="space-y-4">
      {/* Empresa */}
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Empresa</label>
        {lockEmpresa ? (
          <div className="w-full border border-border-subtle rounded-lg px-3 py-2 text-sm bg-surface-sunken text-text-secondary">
            {lockedEmpresaNombre ?? (
              <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                <Loader2 size={14} className="animate-spin" />
                Cargando…
              </span>
            )}
          </div>
        ) : (
          <select
            value={empresaId}
            onChange={e => setEmpresaId(e.target.value)}
            disabled={loadingEmpresas}
            className={selectCls}
          >
            <option value="">{loadingEmpresas ? 'Cargando…' : 'Seleccionar empresa…'}</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.razon_social}</option>
            ))}
          </select>
        )}
      </div>

      {/* Establecimiento */}
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Establecimiento</label>
        <select
          value={establecimientoId}
          onChange={e => setEstablecimientoId(e.target.value)}
          disabled={!empresaId || loadingEsts}
          className={selectCls}
        >
          <option value="">
            {!empresaId
              ? 'Seleccioná una empresa primero'
              : loadingEsts
                ? 'Cargando…'
                : establecimientos.length === 0
                  ? 'Sin establecimientos'
                  : 'Seleccionar establecimiento…'}
          </option>
          {establecimientos.map(e => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end pt-1">
        <Button type="button" onClick={handleContinue} disabled={!empresaId || !establecimientoId}>
          Continuar
        </Button>
      </div>
    </div>
  )
}
