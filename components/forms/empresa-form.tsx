'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PROVINCIAS_AR } from '@/lib/constants'
import type { Empresa, ActionResult } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmpresaFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<unknown>>

interface EmpresaFormProps {
  action: EmpresaFormAction
  empresa?: Partial<Empresa>
  submitLabel?: string
}

const provinciaOptions = PROVINCIAS_AR.map(p => ({ value: p, label: p }))

export function EmpresaForm({ action, empresa, submitLabel = 'Guardar' }: EmpresaFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <Input
        label="Razón Social"
        name="razon_social"
        defaultValue={empresa?.razon_social}
        required
        placeholder="Empresa S.A."
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="CUIT"
          name="cuit"
          defaultValue={empresa?.cuit ?? ''}
          placeholder="20-12345678-9"
        />
        <Input
          label="Rubro"
          name="rubro"
          defaultValue={empresa?.rubro ?? ''}
          placeholder="Construcción"
        />
      </div>

      <Input
        label="Domicilio"
        name="domicilio"
        defaultValue={empresa?.domicilio ?? ''}
        placeholder="Av. Corrientes 1234"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Localidad"
          name="localidad"
          defaultValue={empresa?.localidad ?? ''}
          placeholder="Buenos Aires"
        />
        <Select
          label="Provincia"
          name="provincia"
          defaultValue={empresa?.provincia ?? ''}
          options={provinciaOptions}
          placeholder="Seleccionar..."
        />
      </div>

      <Input
        label="Código Postal"
        name="codigo_postal"
        defaultValue={empresa?.codigo_postal ?? ''}
        placeholder="1001"
        className="w-32"
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
