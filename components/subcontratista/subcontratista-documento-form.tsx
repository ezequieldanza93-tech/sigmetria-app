'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import type { ActionResult, DocumentType } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocAction = (prevState: any, formData: FormData) => Promise<ActionResult<null>>

interface Props {
  action: DocAction
  documentTypes: DocumentType[]
  onSuccess: () => void
}

export function SubcontratistaDocumentoForm({ action, documentTypes, onSuccess }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [observaciones, setObservaciones] = useState('')

  // Handle success
  if (state?.success) {
    onSuccess()
    return null
  }

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <Select
        label="Tipo de documento *"
        name="tipo_id"
        required
        defaultValue=""
        options={documentTypes.map(t => ({ value: t.id, label: t.nombre }))}
        placeholder="Seleccionar tipo…"
      />

      <FileUploadInput
        name="archivo"
        label="Archivo"
        accept=".pdf,.jpg,.jpeg,.png"
        maxSizeMB={10}
        kind="document"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Fecha de emisión" name="fecha_emision" type="date" />
        <Input label="Fecha de vencimiento" name="fecha_vencimiento" type="date" />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Observaciones</label>
        <VoiceTextarea
          name="observaciones"
          rows={2}
          value={observaciones}
          onValueChange={setObservaciones}
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
          placeholder="Observaciones opcionales…"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Subiendo…' : 'Guardar Documento'}
        </Button>
        <Button type="button" variant="secondary" onClick={onSuccess}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
