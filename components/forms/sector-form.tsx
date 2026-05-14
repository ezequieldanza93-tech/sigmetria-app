'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ActionResult } from '@/lib/types'

type SectorFormAction = (
  prevState: ActionResult<null> | null,
  formData: FormData
) => Promise<ActionResult<null>>

interface SectorFormProps {
  action: SectorFormAction
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
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <Input
        label="Nombre del Sector"
        name="nombre"
        required
        placeholder="Depósito"
      />

      <Input
        label="Cantidad de Trabajadores"
        name="cantidad_trabajadores"
        type="number"
        min="0"
        defaultValue="0"
        placeholder="0"
      />

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Agregar Sector'}
        </Button>
      </div>
    </form>
  )
}
