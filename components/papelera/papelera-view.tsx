'use client'

/**
 * Vista de la papelera de reciclaje (admin principal). Lista lo que está en
 * papelera (empresa / establecimiento / sector / puesto) de la consultora y
 * permite restaurar. El gating real lo hace la page (server) + las actions.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2 } from 'lucide-react'
import { listarPapelera, restaurarDePapelera, type PapeleraItem } from '@/lib/actions/papelera'

export function PapeleraView() {
  const [items, setItems] = useState<PapeleraItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    const res = await listarPapelera()
    if (res.success) setItems(res.data)
    else { setError(res.error); setItems([]) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function restaurar(it: PapeleraItem) {
    setRestaurando(it.id)
    setError(null)
    const res = await restaurarDePapelera(it.tabla, it.id)
    setRestaurando(null)
    if (res.success) cargar()
    else setError(res.error)
  }

  if (items === null) {
    return (
      <p className="text-sm text-text-tertiary inline-flex items-center gap-1.5">
        <Loader2 size={14} className="animate-spin" /> Cargando papelera…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 size={18} className="text-text-secondary" />
        <h1 className="text-xl font-bold text-text-primary">Papelera de reciclaje</h1>
      </div>
      <p className="text-sm text-text-tertiary">
        Lo borrado se conserva 90 días y se puede restaurar. Pasado ese plazo deja de estar disponible.
        La auditoría se mantiene siempre.
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}

      {items.length === 0 ? (
        <div className="bg-surface-elevated border border-border-subtle rounded-xl p-12 text-center">
          <p className="font-semibold text-text-primary">La papelera está vacía</p>
          <p className="text-sm text-text-tertiary mt-1">No hay nada borrado para restaurar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(it => (
            <div key={`${it.tabla}-${it.id}`} className="bg-surface-base border border-border-default rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-sunken text-text-secondary uppercase tracking-wider">
                    {it.tablaLabel}
                  </span>
                  <span className="font-medium text-text-primary">{it.nombre}</span>
                  {it.contexto && <span className="text-xs text-text-tertiary">· {it.contexto}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-text-tertiary">
                  <span>{it.diasRestantes} día{it.diasRestantes !== 1 ? 's' : ''} para que se elimine</span>
                  {it.deletedPor && <span>Borrado por {it.deletedPor}</span>}
                  {it.deletedReason && <span className="italic">«{it.deletedReason}»</span>}
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => restaurar(it)} disabled={restaurando === it.id}>
                {restaurando === it.id
                  ? <><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Restaurando…</>
                  : 'Restaurar'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
