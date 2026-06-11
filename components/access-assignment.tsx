'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setUserAccess } from '@/lib/actions/acceso'
import type { Empresa, Establecimiento } from '@/lib/types'

interface AccessItem {
  empresa_id: string
  establecimiento_id: string | null
}

interface EmpresaConEstablecimientos extends Empresa {
  establecimientos: Establecimiento[]
  /** false = el granter no puede otorgar la empresa entera (solo establecimientos puntuales). */
  puedeEmpresaEntera?: boolean
}

interface AccessAssignmentProps {
  targetUserId: string
  empresas: EmpresaConEstablecimientos[]
  currentAccess: AccessItem[]
}

export function AccessAssignment({ targetUserId, empresas, currentAccess }: AccessAssignmentProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // State: set of keys "empresa_id::null" or "empresa_id::estId"
  const toKey = (empresaId: string, estId: string | null) => `${empresaId}::${estId ?? 'null'}`

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(currentAccess.map(a => toKey(a.empresa_id, a.establecimiento_id)))
  )

  // Expanded empresas (to show establecimientos)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(empresaId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(empresaId)) next.delete(empresaId)
      else next.add(empresaId)
      return next
    })
  }

  function isEmpresaEntera(empresaId: string) {
    return selected.has(toKey(empresaId, null))
  }

  function toggleEmpresaEntera(empresaId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      const key = toKey(empresaId, null)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function isEstablecimientoSelected(empresaId: string, estId: string) {
    return selected.has(toKey(empresaId, estId))
  }

  function toggleEstablecimiento(empresaId: string, estId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      const key = toKey(empresaId, estId)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleSave() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const accesoItems: AccessItem[] = []
      selected.forEach(key => {
        const [empresaId, estPart] = key.split('::')
        accesoItems.push({
          empresa_id: empresaId,
          establecimiento_id: estPart === 'null' ? null : estPart,
        })
      })

      const result = await setUserAccess(targetUserId, accesoItems)
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-success-bg border border-green-200 text-success text-sm rounded-lg px-4 py-3">
          Accesos actualizados correctamente
        </div>
      )}

      <div className="bg-surface-base rounded-xl border border-border-subtle divide-y divide-gray-100">
        {empresas.map(empresa => {
          const soloEst = empresa.puedeEmpresaEntera === false
          const showEst = soloEst || expanded.has(empresa.id)
          return (
          <div key={empresa.id} className="p-4">
            <div className="flex items-center gap-3">
              {!soloEst ? (
                <>
                  {/* Empresa entera checkbox */}
                  <input
                    type="checkbox"
                    id={`emp-${empresa.id}`}
                    checked={isEmpresaEntera(empresa.id)}
                    onChange={() => toggleEmpresaEntera(empresa.id)}
                    className="w-4 h-4 text-sig-500 rounded border-border-default focus:ring-sig-500"
                  />
                  <label
                    htmlFor={`emp-${empresa.id}`}
                    className="flex-1 font-medium text-text-primary text-sm cursor-pointer"
                  >
                    {empresa.razon_social}
                    <span className="text-text-tertiary text-xs font-normal ml-2">empresa entera</span>
                  </label>
                </>
              ) : (
                <span className="flex-1 font-medium text-text-primary text-sm">{empresa.razon_social}</span>
              )}

              {!soloEst && empresa.establecimientos.length > 0 && (
                <button
                  onClick={() => toggleExpand(empresa.id)}
                  className="text-xs text-sig-500 hover:text-sig-700"
                >
                  {expanded.has(empresa.id) ? 'Ocultar' : `Ver establecimientos (${empresa.establecimientos.length})`}
                </button>
              )}
            </div>

            {/* Establecimientos */}
            {showEst && empresa.establecimientos.length > 0 && (
              <div className="mt-3 ml-7 space-y-2">
                {empresa.establecimientos.map(est => (
                  <div key={est.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`est-${est.id}`}
                      checked={isEstablecimientoSelected(empresa.id, est.id)}
                      onChange={() => toggleEstablecimiento(empresa.id, est.id)}
                      className="w-4 h-4 text-sig-500 rounded border-border-default focus:ring-sig-500"
                    />
                    <label
                      htmlFor={`est-${est.id}`}
                      className="text-sm text-text-secondary cursor-pointer"
                    >
                      {est.nombre}
                      {est.localidades && (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <span className="text-text-tertiary ml-1">— {(est.localidades as any).nombre}</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          )
        })}

        {empresas.length === 0 && (
          <div className="p-8 text-center text-text-tertiary text-sm">
            No hay empresas disponibles en esta consultora
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar Accesos'}
        </Button>
      </div>
    </div>
  )
}
