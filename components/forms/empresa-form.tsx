'use client'

import { useActionState, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { Empresa, Localidad, ActionResult } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmpresaFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<unknown>>

interface EmpresaFormProps {
  action: EmpresaFormAction
  empresa?: Partial<Empresa>
  submitLabel?: string
}

export function EmpresaForm({ action, empresa, submitLabel = 'Guardar' }: EmpresaFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [artOrgs, setArtOrgs] = useState<{ id: string; nombre: string }[]>([])
  const [localidades, setLocalidades] = useState<Localidad[]>([])
  const [selectedProvincia, setSelectedProvincia] = useState(empresa?.localidades?.provincia ?? '')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('organizaciones_externas')
        .select('id, nombre, tipo_organizaciones!inner(nombre)')
        .eq('tipo_organizaciones.nombre', 'ART')
        .eq('is_active', true)
        .or(empresa?.id ? `scope.eq.global,empresa_id.eq.${empresa.id}` : 'scope.eq.global')
        .order('nombre'),
      supabase
        .from('localidades')
        .select('id, nombre, provincia, is_active, created_at')
        .eq('is_active', true)
        .order('nombre'),
    ]).then(([{ data: arts }, { data: locs }]) => {
      if (arts) setArtOrgs(arts as { id: string; nombre: string }[])
      if (locs) setLocalidades(locs as Localidad[])
    })
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
        label="Razón Social"
        name="razon_social"
        defaultValue={empresa?.razon_social}
        required
        placeholder="Empresa S.A."
      />

      <div className="grid grid-cols-3 gap-4">
        <Select
          label="Tipo identidad impositiva"
          name="tipo_identidad_impositiva"
          defaultValue={empresa?.tipo_identidad_impositiva ?? ''}
          options={[
            { value: 'CUIT', label: 'CUIT' },
            { value: 'CUIL', label: 'CUIL' },
            { value: 'CDI', label: 'CDI' },
          ]}
          placeholder="—"
        />
        <Input
          label="Código único impositivo"
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
          defaultValue={empresa?.localidad_id ?? ''}
          options={localidadesFiltradas.map(l => ({ value: l.id, label: l.nombre }))}
          placeholder={selectedProvincia ? 'Seleccionar localidad...' : 'Elegí provincia primero'}
          disabled={!selectedProvincia}
        />
      </div>

      <Input
        label="Código Postal"
        name="codigo_postal"
        defaultValue={empresa?.codigo_postal ?? ''}
        placeholder="1001"
        className="w-32"
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="ART"
          name="art_id"
          defaultValue={empresa?.art_id ?? ''}
          options={artOrgs.map(o => ({ value: o.id, label: o.nombre }))}
          placeholder="Seleccionar ART..."
        />
        <Input
          label="Nº de contrato ART"
          name="art_numero_contrato"
          defaultValue={empresa?.art_numero_contrato ?? ''}
          placeholder="Nº de contrato"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Logo pequeño (URL)"
          name="logo_small_url"
          defaultValue={empresa?.logo_small_url ?? ''}
          placeholder="https://…"
        />
        <Input
          label="Logo destacado (URL)"
          name="logo_destacado_url"
          defaultValue={empresa?.logo_destacado_url ?? ''}
          placeholder="https://…"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Información general</label>
        <textarea
          name="informacion_general"
          defaultValue={empresa?.informacion_general ?? ''}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
          placeholder="Descripción, notas o información adicional de la empresa…"
        />
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
