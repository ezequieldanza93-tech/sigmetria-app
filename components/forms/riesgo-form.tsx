'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { RIESGO_NIVEL_OPTIONS } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'

type RiesgoFormAction = (
  prevState: ActionResult<null> | null,
  formData: FormData
) => Promise<ActionResult<null>>

interface RiesgoFormProps {
  action: RiesgoFormAction
  onSuccess: () => void
}

export function RiesgoForm({ action, onSuccess }: RiesgoFormProps) {
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
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <Textarea
        label="Descripción del Riesgo"
        name="descripcion"
        required
        placeholder="Describir el riesgo identificado..."
        rows={2}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Nivel de Riesgo"
          name="nivel"
          required
          options={RIESGO_NIVEL_OPTIONS}
          placeholder="Seleccionar..."
        />

        <Input
          label="Fecha de Identificación"
          name="fecha_identificacion"
          type="date"
          required
          defaultValue={new Date().toISOString().split('T')[0]}
        />
      </div>

      <Textarea
        label="Medida Correctiva"
        name="medida_correctiva"
        placeholder="Acción a tomar..."
        rows={2}
      />

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Registrar Riesgo'}
        </Button>
      </div>
    </form>
  )
}
