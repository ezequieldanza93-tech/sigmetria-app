'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import type { ActionResult, EnteRegulador } from '@/lib/types'

type InspeccionFormAction = (
  prevState: ActionResult<null> | null,
  formData: FormData
) => Promise<ActionResult<null>>

interface InspeccionFormProps {
  action: InspeccionFormAction
  onSuccess: () => void
}

export function InspeccionForm({ action, onSuccess }: InspeccionFormProps) {
  const [entes, setEntes] = useState<EnteRegulador[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('entes_reguladores')
      .select('id, nombre, abreviatura')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setEntes((data ?? []) as EnteRegulador[]))
  }, [])

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

      <Input
        label="Fecha *"
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

      <div>
        <label className="text-xs text-text-secondary block mb-1">Ente regulador</label>
        <select name="ente_regulador_id" className="w-full border border-border-default rounded px-3 py-2 text-sm bg-surface-base">
          <option value="">Seleccioná un ente…</option>
          {entes.map(e => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      <Input
        label="Otro ente (especificar)"
        name="ente_especificar"
        placeholder="Nombre del ente si no está en la lista"
      />

      <Textarea
        label="Observaciones"
        name="observaciones"
        placeholder="Detallar resultados de la inspección..."
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
