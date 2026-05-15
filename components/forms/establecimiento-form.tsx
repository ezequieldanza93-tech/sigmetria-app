'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { TIPO_ESTABLECIMIENTO_OPTIONS, PROVINCIAS_AR } from '@/lib/constants'
import type { Establecimiento, ActionResult } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EstablecimientoFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<unknown>>

interface EstablecimientoFormProps {
  action: EstablecimientoFormAction
  establecimiento?: Partial<Establecimiento>
  submitLabel?: string
}

const provinciaOptions = PROVINCIAS_AR.map(p => ({ value: p, label: p }))

export function EstablecimientoForm({ action, establecimiento, submitLabel = 'Guardar' }: EstablecimientoFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <Input
        label="Nombre del Establecimiento"
        name="nombre"
        defaultValue={establecimiento?.nombre}
        required
        placeholder="Planta Norte"
      />

      <Select
        label="Tipo"
        name="tipo"
        defaultValue={establecimiento?.tipo ?? ''}
        options={TIPO_ESTABLECIMIENTO_OPTIONS}
        placeholder="Seleccionar tipo..."
      />

      <Input
        label="Domicilio"
        name="domicilio"
        defaultValue={establecimiento?.domicilio ?? ''}
        placeholder="Calle 123"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Localidad"
          name="localidad"
          defaultValue={establecimiento?.localidad ?? ''}
          placeholder="Rosario"
        />
        <Select
          label="Provincia"
          name="provincia"
          defaultValue={establecimiento?.provincia ?? ''}
          options={provinciaOptions}
          placeholder="Seleccionar..."
        />
      </div>

      <Input
        label="Código Postal"
        name="codigo_postal"
        defaultValue={establecimiento?.codigo_postal ?? ''}
        placeholder="2000"
      />

      <Input
        label="Actividad Principal"
        name="actividad_principal"
        defaultValue={establecimiento?.actividad_principal ?? ''}
        placeholder="Manufactura de piezas metálicas"
      />

      <Input
        label="Cantidad Total de Trabajadores"
        name="cantidad_trabajadores"
        type="number"
        min="0"
        defaultValue={establecimiento?.cantidad_trabajadores?.toString() ?? ''}
        placeholder="50"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación Google Maps</label>
        <input
          name="ubicacion_gmaps"
          type="text"
          defaultValue={
            establecimiento?.latitude != null && establecimiento?.longitude != null
              ? `${establecimiento.latitude}, ${establecimiento.longitude}`
              : ''
          }
          placeholder="Av. Corrientes 1234, Buenos Aires · o URL de Google Maps · o -34.6037, -58.3816"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Podés escribir una dirección, pegar una URL de Google Maps, o ingresar coordenadas.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Foto del establecimiento</label>
        {establecimiento?.photo_site && (
          <img
            src={establecimiento.photo_site}
            alt="Foto actual"
            className="w-full h-40 object-cover rounded-lg mb-2 border border-gray-200"
          />
        )}
        <input
          name="foto"
          type="file"
          accept="image/*"
          className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />
        <p className="text-xs text-gray-400 mt-1">JPG, PNG o WebP. Se reemplaza la existente al guardar.</p>
      </div>

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
