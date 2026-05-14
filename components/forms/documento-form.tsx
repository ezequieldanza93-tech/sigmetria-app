'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DOCUMENTO_TIPO_OPTIONS } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'

type DocumentoFormAction = (
  prevState: ActionResult<null> | null,
  formData: FormData
) => Promise<ActionResult<null>>

interface DocumentoFormProps {
  action: DocumentoFormAction
  onSuccess: () => void
}

export function DocumentoForm({ action, onSuccess }: DocumentoFormProps) {
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
        label="Nombre del Documento"
        name="nombre"
        required
        placeholder="Habilitación Municipal 2025"
      />

      <Select
        label="Tipo"
        name="tipo"
        required
        options={DOCUMENTO_TIPO_OPTIONS}
        placeholder="Seleccionar tipo..."
      />

      <Input
        label="URL del Archivo"
        name="archivo_url"
        type="url"
        placeholder="https://..."
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Fecha de Emisión"
          name="fecha_emision"
          type="date"
        />

        <Input
          label="Fecha de Vencimiento"
          name="fecha_vencimiento"
          type="date"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Agregar Documento'}
        </Button>
      </div>
    </form>
  )
}
