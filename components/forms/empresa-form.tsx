'use client'

import { useActionState, useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { createPrivateArt } from '@/lib/actions/empresa'
import type { Empresa, Localidad, Rubro } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmpresaFormAction = (prevState: any, formData: FormData) => Promise<any>

interface EmpresaFormProps {
  action: EmpresaFormAction
  empresa?: Partial<Empresa>
  submitLabel?: string
}

interface FormState {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  fields?: Record<string, string>
}

export function EmpresaForm({ action, empresa, submitLabel = 'Guardar' }: EmpresaFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [artOrgs, setArtOrgs] = useState<{ id: string; nombre: string }[]>([])
  const [localidades, setLocalidades] = useState<Localidad[]>([])
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [selectedProvincia, setSelectedProvincia] = useState(empresa?.localidades?.provincia ?? '')
  const [selectedArtId, setSelectedArtId] = useState(empresa?.art_id ?? '')
  const [selectedRubroId, setSelectedRubroId] = useState(empresa?.rubro_id ?? '')
  const [showAddArt, setShowAddArt] = useState(false)
  const [newArtName, setNewArtName] = useState('')
  const [addArtPending, setAddArtPending] = useState(false)
  const [addArtError, setAddArtError] = useState('')

  const formRef = useRef<HTMLFormElement>(null)
  const fieldErrors = (state as FormState | null)?.fieldErrors ?? {}
  const values = (state as FormState | null)?.fields ?? {}

  useEffect(() => {
    const stateRubroId = (state as FormState | null)?.fields?.rubro_id
    if (stateRubroId) setSelectedRubroId(stateRubroId)
  }, [state])

  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0 && formRef.current) {
      const firstErrorField = Object.keys(fieldErrors)[0]
      const firstErrorEl = formRef.current.querySelector<HTMLElement>(
        `[name="${firstErrorField}"]`
      )
      firstErrorEl?.focus()
    }
  }, [fieldErrors])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('organizaciones_externas')
        .select('id, nombre, organizaciones_tipos!inner(nombre)')
        .eq('organizaciones_tipos.nombre', 'ART')
        .eq('is_active', true)
        .or(empresa?.id ? `scope.eq.global,empresa_id.eq.${empresa.id}` : 'scope.eq.global')
        .order('nombre'),
      supabase
        .from('localidades')
        .select('id, nombre, provincia, is_active, created_at')
        .eq('is_active', true)
        .order('nombre'),
      supabase
        .from('empresas_rubros')
        .select('*')
        .eq('is_active', true)
        .order('nombre'),
    ]).then(([{ data: arts }, { data: locs }, { data: rubrosData }]) => {
      if (arts) setArtOrgs(arts as { id: string; nombre: string }[])
      if (locs) setLocalidades(locs as Localidad[])
      if (rubrosData) setRubros(rubrosData as Rubro[])
    })
  }, [])

  const provincias = [...new Set(localidades.map(l => l.provincia))].sort()
  const localidadesFiltradas = localidades.filter(l => l.provincia === selectedProvincia)

  function fieldValue(name: string): string {
    if (name === 'rubro_id' && (values.rubro_id || empresa?.rubro_id)) {
      return values.rubro_id ?? empresa?.rubro_id ?? ''
    }
    return values[name] ?? (empresa as Record<string, string | undefined>)?.[name] ?? ''
  }

  async function handleAddArt() {
    if (!empresa?.id || !newArtName.trim()) return
    setAddArtPending(true)
    setAddArtError('')
    const result = await createPrivateArt(empresa.id, newArtName)
    setAddArtPending(false)
    if (!result.success) {
      setAddArtError(result.error ?? 'Error al crear la ART')
      return
    }
    const newArt = result.data as { id: string; nombre: string }
    setArtOrgs(prev => [...prev, newArt].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setSelectedArtId(newArt.id)
    setNewArtName('')
    setShowAddArt(false)
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {state && !state.success && state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <Input
        label="Razón Social"
        name="razon_social"
        defaultValue={fieldValue('razon_social')}
        required
        placeholder="Empresa S.A."
        error={fieldErrors.razon_social}
      />

      <div className="grid grid-cols-3 gap-4">
        <Select
          label="Tipo identidad impositiva"
          name="tipo_identidad_impositiva"
          defaultValue={fieldValue('tipo_identidad_impositiva')}
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
          defaultValue={fieldValue('cuit')}
          placeholder="20-12345678-9"
        />
        <Select
          label="Rubro"
          name="rubro_id"
          value={selectedRubroId}
          onChange={e => setSelectedRubroId(e.target.value)}
          options={rubros.map(r => ({ value: r.id, label: r.nombre }))}
          placeholder="Seleccionar rubro..."
        />
      </div>

      <Input
        label="Domicilio"
        name="domicilio"
        defaultValue={fieldValue('domicilio')}
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
          defaultValue={fieldValue('localidad_id')}
          options={localidadesFiltradas.map(l => ({ value: l.id, label: l.nombre }))}
          placeholder={selectedProvincia ? 'Seleccionar localidad...' : 'Elegí provincia primero'}
          disabled={!selectedProvincia}
        />
      </div>

      <Input
        label="Código Postal"
        name="codigo_postal"
        defaultValue={fieldValue('codigo_postal')}
        placeholder="1001"
        className="w-32"
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Select
            label="ART"
            name="art_id"
            value={selectedArtId}
            onChange={e => setSelectedArtId(e.target.value)}
            options={artOrgs.map(o => ({ value: o.id, label: o.nombre }))}
            placeholder="Seleccionar ART..."
          />
          {empresa?.id && !showAddArt && (
            <button
              type="button"
              onClick={() => setShowAddArt(true)}
              className="mt-1 text-xs text-sig-500 hover:text-sig-700 hover:underline"
            >
              + No encontrás tu ART? Agregar nueva
            </button>
          )}
          {showAddArt && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={newArtName}
                onChange={e => setNewArtName(e.target.value)}
                placeholder="Nombre de la ART..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddArt() } }}
                autoFocus
              />
              {addArtError && <p className="text-xs text-red-600">{addArtError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddArt}
                  disabled={addArtPending || !newArtName.trim()}
                  className="text-xs bg-sig-500 hover:bg-sig-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  {addArtPending ? 'Creando...' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddArt(false); setNewArtName(''); setAddArtError('') }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
        <Input
          label="Nº de contrato ART"
          name="art_numero_contrato"
          defaultValue={fieldValue('art_numero_contrato')}
          placeholder="Nº de contrato"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Logo pequeño (URL)"
          name="logo_small_url"
          defaultValue={fieldValue('logo_small_url')}
          placeholder="https://…"
        />
        <Input
          label="Logo destacado (URL)"
          name="logo_destacado_url"
          defaultValue={fieldValue('logo_destacado_url')}
          placeholder="https://…"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Información general</label>
        <textarea
          name="informacion_general"
          defaultValue={fieldValue('informacion_general')}
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
