'use client'

/**
 * Toggle Activo/Inactivo para empresa / establecimiento / sector / puesto.
 * A diferencia del borrado (papelera), lo inactivo SIGUE viéndose. Solo lo
 * renderiza el caller para el admin principal.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cambiarEstadoActivo, type EntidadPapelera } from '@/lib/actions/papelera'

export function EstadoActivoToggle({
  tabla,
  id,
  activo,
}: {
  tabla: EntidadPapelera
  id: string
  activo: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setPending(true)
    setError(null)
    const res = await cambiarEstadoActivo(tabla, id, !activo)
    setPending(false)
    if (res.success) router.refresh()
    else setError(res.error)
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={activo ? 'Marcar como inactiva' : 'Marcar como activa'}
        className="inline-flex items-center gap-1.5 border border-border-default text-text-tertiary hover:bg-surface-elevated hover:text-text-primary text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {activo ? 'Marcar inactiva' : 'Marcar activa'}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  )
}
