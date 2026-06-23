'use client'

import { useActionState, useRef, useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import { DireccionAutocomplete } from '@/components/ui/direccion-autocomplete'
import { createClient } from '@/lib/supabase/client'
import { createPrivateArt } from '@/lib/actions/empresa'
import { publicAssetUrl } from '@/lib/storage/asset-url'
import type { Empresa, Localidad } from '@/lib/types'

interface ActividadCiiu { id: string; codigo: string; nombre: string }

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
  const [actividades, setActividades] = useState<ActividadCiiu[]>([])
  const [selectedProvincia, setSelectedProvincia] = useState(empresa?.localidades?.provincia ?? '')
  const [showAddArt, setShowAddArt] = useState(false)
  const [newArtName, setNewArtName] = useState('')
  const [newArtPreview, setNewArtPreview] = useState<string | null>(null)
  const [addArtPending, setAddArtPending] = useState(false)
  const [addArtError, setAddArtError] = useState('')

  const formRef = useRef<HTMLFormElement>(null)
  const fieldErrors = useMemo(() => (state as FormState | null)?.fieldErrors ?? {}, [state])
  const submitted = state !== null

  // ── Campos controlados: NO se borran al fallar la action (React 19 resetea los
  //    inputs no controlados; estos persisten porque viven en estado). ───────────
  const [form, setForm] = useState<Record<string, string>>(() => ({
    razon_social: empresa?.razon_social ?? '',
    tipo_identidad_impositiva: (empresa?.tipo_identidad_impositiva as string | undefined) ?? '',
    cuit: empresa?.cuit ?? '',
    actividad_id: (empresa?.actividad_id as string | undefined) ?? '',
    domicilio: empresa?.domicilio ?? '',
    localidad_id: (empresa?.localidad_id as string | undefined) ?? '',
    codigo_postal: empresa?.codigo_postal ?? '',
    latitude: empresa?.latitude != null ? String(empresa.latitude) : '',
    longitude: empresa?.longitude != null ? String(empresa.longitude) : '',
    art_id: (empresa?.art_id as string | undefined) ?? '',
    art_numero_contrato: empresa?.art_numero_contrato ?? '',
    informacion_general: (empresa?.informacion_general as string | undefined) ?? '',
  }))

  const set = (name: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [name]: e.target.value }))

  // Belt-and-suspenders: si la action devolvió los valores (error), re-aplicarlos.
  useEffect(() => {
    const f = (state as FormState | null)?.fields
    if (f && Object.keys(f).length > 0) setForm(prev => ({ ...prev, ...f }))
  }, [state])

  // Feedback por campo: error (cruz roja) / valid (tilde verde, tras intentar enviar).
  function fb(name: string) {
    const error = fieldErrors[name]
    return { error, valid: submitted && !error && !!form[name]?.trim() }
  }

  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0 && formRef.current) {
      const firstErrorField = Object.keys(fieldErrors)[0]
      const firstErrorEl = formRef.current.querySelector<HTMLElement>(`[name="${firstErrorField}"]`)
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
        .from('actividades_economicas')
        .select('id, codigo, nombre')
        .eq('is_active', true)
        .order('codigo'),
    ]).then(([{ data: arts }, { data: locs }, { data: actividadesData }]) => {
      if (arts) setArtOrgs(arts as { id: string; nombre: string }[])
      if (locs) setLocalidades(locs as Localidad[])
      if (actividadesData) setActividades(actividadesData as ActividadCiiu[])
    })
  }, [empresa?.id])

  const provincias = [...new Set(localidades.map(l => l.provincia))].sort()
  const localidadesFiltradas = localidades.filter(l => l.provincia === selectedProvincia)

  async function handleAddArt() {
    if (!newArtName.trim()) return
    if (empresa?.id) {
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
      setForm(f => ({ ...f, art_id: newArt.id }))
    } else {
      setNewArtPreview(newArtName.trim())
    }
    setNewArtName('')
    setShowAddArt(false)
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 max-md:space-y-6" noValidate>
      {state && !state.success && state.error && (
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
          {Object.keys(fieldErrors).length > 0 && (
            <span className="block mt-1 text-xs">Revisá los campos marcados en rojo. Lo que cargaste bien quedó guardado. ✓</span>
          )}
        </div>
      )}

      <Input
        label="Razón Social"
        name="razon_social"
        value={form.razon_social}
        onChange={set('razon_social')}
        required
        placeholder="Empresa S.A."
        {...fb('razon_social')}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Tipo identidad impositiva"
          name="tipo_identidad_impositiva"
          value={form.tipo_identidad_impositiva}
          onChange={set('tipo_identidad_impositiva')}
          options={[
            { value: 'CUIT', label: 'CUIT' },
            { value: 'CUIL', label: 'CUIL' },
            { value: 'CDI', label: 'CDI' },
          ]}
          placeholder="—"
          {...fb('tipo_identidad_impositiva')}
        />
        <Input
          label="Código único impositivo"
          name="cuit"
          value={form.cuit}
          onChange={set('cuit')}
          placeholder="20-12345678-9"
          {...fb('cuit')}
        />
        <SearchableSelect
          label="Rubro (CIIU)"
          name="actividad_id"
          value={form.actividad_id}
          onChange={v => setForm(f => ({ ...f, actividad_id: v }))}
          options={actividades.map(a => ({ value: a.id, label: `${a.codigo} — ${a.nombre}` }))}
          placeholder="Seleccionar actividad económica..."
          {...fb('actividad_id')}
        />
      </div>

      <DireccionAutocomplete
        label="Domicilio"
        name="domicilio"
        defaultValue={form.domicilio}
        latName="latitude"
        lonName="longitude"
        defaultLat={empresa?.latitude ?? null}
        defaultLon={empresa?.longitude ?? null}
        placeholder="Av. Corrientes 1234, Buenos Aires"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SearchableSelect
          label="Provincia"
          value={selectedProvincia}
          onChange={v => {
            setSelectedProvincia(v)
            setForm(f => ({ ...f, localidad_id: '' }))
          }}
          options={provincias.map(p => ({ value: p, label: p }))}
          placeholder="Seleccionar provincia..."
        />
        <SearchableSelect
          label="Localidad"
          name="localidad_id"
          value={form.localidad_id}
          onChange={v => setForm(f => ({ ...f, localidad_id: v }))}
          options={localidadesFiltradas.map(l => ({ value: l.id, label: l.nombre }))}
          placeholder={selectedProvincia ? 'Seleccionar localidad...' : 'Elegí provincia primero'}
          disabled={!selectedProvincia}
          {...fb('localidad_id')}
        />
      </div>

      <Input
        label="Código Postal"
        name="codigo_postal"
        value={form.codigo_postal}
        onChange={set('codigo_postal')}
        placeholder="1001"
        className="w-32"
        {...fb('codigo_postal')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Select
            label="ART"
            name="art_id"
            value={form.art_id}
            onChange={set('art_id')}
            options={artOrgs.map(o => ({ value: o.id, label: o.nombre }))}
            placeholder="Seleccionar ART..."
            {...fb('art_id')}
          />
          {!showAddArt && !newArtPreview && (
            <button
              type="button"
              onClick={() => setShowAddArt(true)}
              className="mt-1 text-xs text-sig-500 hover:text-sig-700 hover:underline"
            >
              + No encontrás tu ART? Agregar nueva
            </button>
          )}
          {newArtPreview && !empresa?.id && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-sig-50 border border-sig-200 rounded-lg">
              <span className="text-xs text-sig-700 flex-1">Nueva ART: <strong>{newArtPreview}</strong></span>
              <button
                type="button"
                onClick={() => setNewArtPreview(null)}
                className="text-xs text-text-tertiary hover:text-danger transition-colors"
              >
                ✕
              </button>
              <input type="hidden" name="new_art_nombre" value={newArtPreview} />
            </div>
          )}
          {showAddArt && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={newArtName}
                onChange={e => setNewArtName(e.target.value)}
                placeholder="Nombre de la ART..."
                className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddArt() } }}
                autoFocus
              />
              {addArtError && <p className="text-xs text-danger">{addArtError}</p>}
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
                  className="text-xs text-text-secondary hover:text-text-secondary px-3 py-1.5 rounded-lg border border-border-subtle transition-colors"
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
          value={form.art_numero_contrato}
          onChange={set('art_numero_contrato')}
          placeholder="Nº de contrato"
          {...fb('art_numero_contrato')}
        />
      </div>

      <FileUploadInput
        name="logo_destacado"
        label="Logo"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        maxSizeMB={2}
        currentUrl={publicAssetUrl('logos', empresa?.logo_destacado_url ?? empresa?.logo_small_url)}
        helpText="PNG, JPG, WEBP o SVG. Máx 2 MB. La app lo adapta a cada tamaño."
        kind="image"
      />

      <div>
        <label htmlFor="empresa-informacion-general" className="text-sm font-medium text-text-secondary block mb-1">Información general</label>
        <textarea
          id="empresa-informacion-general"
          name="informacion_general"
          value={form.informacion_general}
          onChange={set('informacion_general')}
          rows={3}
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
          placeholder="Descripción, notas o información adicional de la empresa…"
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
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
