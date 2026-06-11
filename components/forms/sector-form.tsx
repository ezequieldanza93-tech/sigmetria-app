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
    <form action={formAction} className="space-y-4 max-md:space-y-6">
      {state && !state.success && (
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="sector-nombre" className="text-xs text-text-secondary block mb-1">Nombre del sector <span aria-hidden="true">*</span></label>
        <input
          id="sector-nombre"
          name="nombre"
          type="text"
          required
          aria-required="true"
          placeholder="Ej: Producción, Mantenimiento…"
          className="w-full border border-border-default rounded px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
        />
      </div>

      <p className="text-xs text-text-tertiary">
        Los trabajadores se asignan desde los puestos de trabajo. La cantidad se calcula automáticamente.
      </p>

      <div className="flex flex-wrap gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Crear Sector'}
        </Button>
      </div>
    </form>
  )
}
