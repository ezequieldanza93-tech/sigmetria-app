'use client'

import { useActionState, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { TIPO_ESTABLECIMIENTO_OPTIONS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { Establecimiento, Localidad, ActionResult } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EstablecimientoFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<unknown>>

interface EstablecimientoFormProps {
  action: EstablecimientoFormAction
  establecimiento?: Partial<Establecimiento>
  submitLabel?: string
}

export function EstablecimientoForm({ action, establecimiento, submitLabel = 'Guardar' }: EstablecimientoFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [localidades, setLocalidades] = useState<Localidad[]>([])
  const [selectedProvincia, setSelectedProvincia] = useState(establecimiento?.localidades?.provincia ?? '')
  const [selectedTipo, setSelectedTipo] = useState(establecimiento?.tipo ?? '')

  useEffect(() => {
    createClient()
      .from('localidades')
      .select('id, nombre, provincia, is_active, created_at')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => { if (data) setLocalidades(data as Localidad[]) })
  }, [])

  const provincias = [...new Set(localidades.map(l => l.provincia))].sort()
  const localidadesFiltradas = localidades.filter(l => l.provincia === selectedProvincia)

  return (
    <form action={formAction} className="space-y-4">
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
        value={selectedTipo}
        onChange={e => setSelectedTipo(e.target.value)}
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
        <Select
          label="Provincia"
          value={selectedProvincia}
          onChange={e => setSelectedProvincia(e.target.value)}
          options={provincias.map(p => ({ value: p, label: p }))}
          placeholder="Seleccionar provincia..."
        />
        <Select
          label="Localidad"
          name="localidad_id"
          defaultValue={establecimiento?.localidad_id ?? ''}
          options={localidadesFiltradas.map(l => ({ value: l.id, label: l.nombre }))}
          placeholder={selectedProvincia ? 'Seleccionar localidad...' : 'Elegí provincia primero'}
          disabled={!selectedProvincia}
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
        label="Horario de Trabajo"
        name="horario_trabajo"
        defaultValue={establecimiento?.horario_trabajo ?? ''}
        placeholder="Lun–Vie 08:00–17:00"
      />

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Información del establecimiento</label>
        <textarea
          name="description"
          defaultValue={establecimiento?.description ?? ''}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
          placeholder="Descripción, notas o información adicional del establecimiento…"
        />
      </div>

      {/* ── Campos específicos Construcción ───────────────────── */}
      {(selectedTipo === 'construccion' || selectedTipo === 'obra_construccion') && (
        <div className="border border-orange-200 rounded-xl p-4 space-y-3 bg-orange-50/40">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Datos de Construcción</p>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {([
              ['tiene_demolicion',         'Demolición'],
              ['tiene_excavacion',         'Excavación'],
              ['tiene_submuración',        'Submuración'],
              ['tiene_alturas_mayores_6m', 'Trabajos en altura &gt; 6m'],
              ['tiene_equipamiento_izaje', 'Equipamiento de izaje'],
            ] as [string, string][]).map(([name, label]) => (
              <label key={name} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name={name}
                  value="true"
                  defaultChecked={!!(establecimiento as any)?.[name]}
                  className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                />
                <span className="text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ __html: label }}
                />
              </label>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de contratista</label>
            <select
              name="tipo_contratista"
              defaultValue={establecimiento?.tipo_contratista ?? ''}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">Sin especificar</option>
              <option value="35/98">Contratista principal — Dec. 35/98</option>
              <option value="51/97">Subcontratista — Dec. 51/97</option>
              <option value="319/99">Subcontratista corta duración — Dec. 319/99</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Campos específicos Industria ────────────────────── */}
      {selectedTipo === 'industria' && (
        <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/40">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Datos de Industria</p>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {([
              ['tiene_agentes_cancerigenos',   'Agentes cancerígenos'],
              ['tiene_sustancias_quimicas',    'Sustancias químicas'],
              ['tiene_exposicion_vibraciones', 'Exposición a vibraciones'],
              ['tiene_exposicion_radiaciones', 'Exposición a radiaciones'],
            ] as [string, string][]).map(([name, label]) => (
              <label key={name} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name={name}
                  value="true"
                  defaultChecked={!!(establecimiento as any)?.[name]}
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Descripción de productos fabricados</label>
            <textarea
              name="descripcion_productos"
              defaultValue={establecimiento?.descripcion_productos ?? ''}
              rows={3}
              placeholder="Descripción de los productos que se fabrican o procesan en el establecimiento…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      )}

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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
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
          className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100 cursor-pointer"
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
