'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult } from '@/lib/types'

type InspeccionFormAction = (
  prevState: ActionResult<null> | null,
  formData: FormData
) => Promise<ActionResult<null>>

interface InspeccionFormProps {
  action: InspeccionFormAction
  onSuccess: () => void
}

export function InspeccionForm({ action, onSuccess }: InspeccionFormProps) {
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
        label="Fecha Programada"
        name="fecha_programada"
        type="date"
        required
        defaultValue={new Date().toISOString().split('T')[0]}
      />

      <Input
        label="Fecha Realizada"
        name="fecha_realizada"
        type="date"
      />

      <Input
        label="Puntaje (0-100)"
        name="puntaje"
        type="number"
        min="0"
        max="100"
        placeholder="85"
      />

      <Textarea
        label="Observaciones"
        name="observaciones"
        placeholder="Detallar observaciones..."
        rows={3}
      />

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Registrar Inspección'}
        </Button>
      </div>
    </form>
  )
}
