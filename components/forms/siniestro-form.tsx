'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SINIESTRO_TIPO_OPTIONS } from '@/lib/constants'
import type { ActionResult, DirectorioPersona } from '@/lib/types'

type SiniestroFormAction = (
  prevState: ActionResult<null> | null,
  formData: FormData
) => Promise<ActionResult<null>>

interface SiniestroFormProps {
  action: SiniestroFormAction
  personas: DirectorioPersona[]
  onSuccess: () => void
}

export function SiniestroForm({ action, personas, onSuccess }: SiniestroFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<null> | null, fd: FormData) => {
      const result = await action(prev, fd)
      if (result.success) onSuccess()
      return result
    },
    null
  )

  const personaOptions = personas.map(p => ({
    value: p.id,
    label: `${p.apellido}, ${p.nombre}${p.dni ? ` — DNI ${p.dni}` : ''}`,
  }))

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <Select
        label="Persona involucrada"
        name="persona_id"
        options={personaOptions}
        placeholder="Seleccionar persona..."
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Tipo"
          name="tipo"
          required
          options={SINIESTRO_TIPO_OPTIONS}
          placeholder="Seleccionar..."
        />

        <Input
          label="Fecha de Ocurrencia"
          name="fecha_ocurrencia"
          type="date"
          required
          defaultValue={new Date().toISOString().split('T')[0]}
        />
      </div>

      <Textarea
        label="Descripción"
        name="descripcion"
        placeholder="Describí el siniestro..."
        rows={3}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Días Perdidos"
          name="dias_perdidos"
          type="number"
          min="0"
          placeholder="0"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Requiere Derivación</label>
          <select
            name="requiere_derivacion"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="false">No</option>
            <option value="true">Sí</option>
          </select>
        </div>
      </div>

      <Textarea
        label="Acciones Correctivas"
        name="acciones_correctivas"
        placeholder="Medidas tomadas..."
        rows={2}
      />

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Registrar Siniestro'}
        </Button>
      </div>
    </form>
  )
}
