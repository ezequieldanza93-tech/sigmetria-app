'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
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
  const [descripcion, setDescripcion] = useState('')
  const [medidaCorrectiva, setMedidaCorrectiva] = useState('')
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

      <VoiceTextarea
        label="Descripción del Riesgo"
        name="descripcion"
        value={descripcion}
        onValueChange={setDescripcion}
        required
        placeholder="Describir el riesgo identificado..."
        rows={2}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <VoiceTextarea
        label="Medida Correctiva"
        name="medida_correctiva"
        value={medidaCorrectiva}
        onValueChange={setMedidaCorrectiva}
        placeholder="Acción a tomar..."
        rows={2}
      />

      <div className="flex flex-wrap gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Registrar Riesgo'}
        </Button>
      </div>
    </form>
  )
}
