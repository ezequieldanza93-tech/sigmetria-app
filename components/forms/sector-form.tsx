'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/types'

type FormAction = (
  prev: ActionResult<null> | null,
  fd: FormData
) => Promise<ActionResult<null>>

interface SectorFormProps {
  action: FormAction
  onSuccess: () => void
}

export function SectorForm({ action, onSuccess }: SectorFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<null> | null, fd: FormData) => {
      const result = await action(prev, fd)
      if (result.success) onSuccess()
      return result
    },
    null
  )

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div>
        <label className="text-xs text-text-secondary block mb-1">Nombre del sector *</label>
        <input
          name="nombre"
          type="text"
          required
          placeholder="Ej: Producción, Mantenimiento…"
          className="w-full border border-border-default rounded px-3 py-2 text-sm"
        />
      </div>

      <p className="text-xs text-text-tertiary">
        Los trabajadores se asignan desde los puestos de trabajo. La cantidad se calcula automáticamente.
      </p>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Crear Sector'}
        </Button>
      </div>
    </form>
  )
}
