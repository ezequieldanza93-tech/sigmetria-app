'use client'

import { useActionState, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type {
  ActionResult,
  TipoOrganizacion,
  SubcontratistaRubro,
  Localidad,
  TiposEstablecimiento,
  PreguntaRiesgo,
} from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrgFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<null>>

interface Props {
  action: OrgFormAction
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-5 mt-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{children}</h3>
    </div>
  )
}

export function OrganizacionExternaForm({ action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  // Tipo selection
  const [tiposOrg, setTiposOrg] = useState<TipoOrganizacion[]>([])
  const [selectedTipoId, setSelectedTipoId] = useState('')
  const [selectedTipoNombre, setSelectedTipoNombre] = useState('')

  // Subcontratista-specific data
  const [rubros, setRubros] = useState<SubcontratistaRubro[]>([])
  const [localidades, setLocalidades] = useState<Localidad[]>([])
  const [tiposEst, setTiposEst] = useState<TiposEstablecimiento[]>([])
  const [artOrgs, setArtOrgs] = useState<{ id: string; nombre: string }[]>([])
  const [preguntas, setPreguntas] = useState<PreguntaRiesgo[]>([])
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>({})
  const [selectedProvincia, setSelectedProvincia] = useState('')
  const [selectedLocalidadId, setSelectedLocalidadId] = useState('')
  const [selectedArtId, setSelectedArtId] = useState('')
  const [selectedTipoEstId, setSelectedTipoEstId] = useState('')

  const isSubcontratista = selectedTipoNombre === 'Subcontratista'

  // Load tipos on mount
  useEffect(() => {
    createClient().from('tipo_organizaciones').select('*').order('nombre')
      .then(({ data }) => { if (data) setTiposOrg(data as TipoOrganizacion[]) })
  }, [])

  // Load subcontratista-specific data when tipo = Subcontratista
  useEffect(() => {
    if (!isSubcontratista) return
    const supabase = createClient()
    Promise.all([
      supabase.from('subcontratistas_rubros').select('*').eq('is_active', true).order('nombre'),
      supabase.from('localidades').select('id, nombre, provincia, is_active, created_at').eq('is_active', true).order('nombre'),
      supabase.from('tipos_establecimiento').select('id, codigo, nombre, created_at').order('nombre'),
      supabase.from('organizaciones_externas')
        .select('id, nombre, tipo_organizaciones!inner(nombre)')
        .eq('tipo_organizaciones.nombre', 'ART')
        .eq('is_active', true)
        .eq('scope', 'global')
        .order('nombre'),
    ]).then(([{ data: rubs }, { data: locs }, { data: tipos }, { data: arts }]) => {
      if (rubs) setRubros(rubs as SubcontratistaRubro[])
      if (locs) setLocalidades(locs as Localidad[])
      if (tipos) setTiposEst(tipos as TiposEstablecimiento[])
      if (arts) setArtOrgs(arts as { id: string; nombre: string }[])
    })
  }, [isSubcontratista])

  // Load preguntas when tipo_establecimiento changes
  useEffect(() => {
    if (!selectedTipoEstId) { setPreguntas([]); return }
    createClient()
      .from('pregunta_tipos')
      .select('pregunta_id, orden, preguntas_riesgo!pregunta_id(id, codigo, texto, orden, is_active)')
      .eq('tipo_id', selectedTipoEstId)
      .order('orden')
      .then(({ data }) => {
        if (!data) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = (data as any[]).map(r => r.preguntas_riesgo).filter(Boolean)
          .sort((a: PreguntaRiesgo, b: PreguntaRiesgo) => a.orden - b.orden)
        setPreguntas(ps as PreguntaRiesgo[])
      })
  }, [selectedTipoEstId])

  function handleTipoChange(id: string) {
    const tipo = tiposOrg.find(t => t.id === id)
    setSelectedTipoId(id)
    setSelectedTipoNombre(tipo?.nombre ?? '')
    // Reset subcontratista state when changing tipo
    setSelectedProvincia('')
    setSelectedLocalidadId('')
    setSelectedArtId('')
    setSelectedTipoEstId('')
    setPreguntas([])
    setRespuestas({})
  }

  const provincias = [...new Set(localidades.map(l => l.provincia))].sort()
  const localidadesFiltradas = localidades.filter(l => l.provincia === selectedProvincia)

  return (
    <form action={formAction} className="space-y-4">
      {/* hidden fields for server action */}
      <input type="hidden" name="tipo_nombre" value={selectedTipoNombre} />

      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      {/* ── Tipo ─────────────────────────────────────────────── */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de organización *</label>
        <select
          name="tipo_id"
          value={selectedTipoId}
          onChange={e => handleTipoChange(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
        >
          <option value="">Seleccioná un tipo…</option>
          {tiposOrg.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </div>

      {/* ── Nombre ───────────────────────────────────────────── */}
      {selectedTipoId && (
        <Input
          label={isSubcontratista ? 'Razón Social *' : 'Nombre *'}
          name="nombre"
          required
          placeholder={isSubcontratista ? 'Constructora S.A.' : 'Nombre de la organización'}
        />
      )}

      {/* ════════════════════════════════════════════════════
          SUBCONTRATISTA — campos extendidos
      ════════════════════════════════════════════════════ */}
      {isSubcontratista && (
        <>
          {/* Identificación impositiva */}
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Tipo identidad impositiva"
              name="tipo_identidad_impositiva"
              defaultValue=""
              options={[
                { value: 'CUIT', label: 'CUIT' },
                { value: 'CUIL', label: 'CUIL' },
                { value: 'CDI', label: 'CDI' },
              ]}
              placeholder="—"
            />
            <Input label="Código único impositivo" name="cuit" placeholder="20-12345678-9" />
            <Select
              label="Rubro *"
              name="rubro_id"
              defaultValue=""
              required
              options={rubros.map(r => ({ value: r.id, label: r.nombre }))}
              placeholder="Seleccionar rubro…"
            />
          </div>

          {/* Ubicación */}
          <SectionTitle>Ubicación</SectionTitle>
          <Input label="Domicilio" name="domicilio" placeholder="Av. Corrientes 1234" />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Provincia"
              value={selectedProvincia}
              onChange={e => { setSelectedProvincia(e.target.value); setSelectedLocalidadId('') }}
              options={provincias.map(p => ({ value: p, label: p }))}
              placeholder="Seleccionar provincia…"
            />
            <Select
              label="Localidad"
              name="localidad_id"
              value={selectedLocalidadId}
              onChange={e => setSelectedLocalidadId(e.target.value)}
              options={localidadesFiltradas.map(l => ({ value: l.id, label: l.nombre }))}
              placeholder={selectedProvincia ? 'Seleccionar localidad…' : 'Elegí provincia primero'}
              disabled={!selectedProvincia}
            />
          </div>
          <Input label="Código Postal" name="codigo_postal" placeholder="1001" className="w-32" />

          {/* ART */}
          <SectionTitle>ART</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="ART"
              name="art_id"
              value={selectedArtId}
              onChange={e => setSelectedArtId(e.target.value)}
              options={artOrgs.map(o => ({ value: o.id, label: o.nombre }))}
              placeholder="Seleccionar ART…"
            />
            <Input label="Nº de contrato ART" name="art_numero_contrato" placeholder="Nº de contrato" />
          </div>

          {/* Actividad */}
          <SectionTitle>Actividad y establecimiento</SectionTitle>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de establecimiento</label>
            <select
              name="tipo_establecimiento_id"
              value={selectedTipoEstId}
              onChange={e => setSelectedTipoEstId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
            >
              <option value="">Seleccionar tipo…</option>
              {tiposEst.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
            {tiposEst.find(t => t.id === selectedTipoEstId)?.codigo === 'CONSTRUCCION' && (
              <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Requiere aviso de inicio de obra según normativa vigente.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Actividad Principal" name="actividad_principal" placeholder="Construcción de obras civiles" />
            <Input label="Cantidad de Trabajadores" name="cantidad_trabajadores" type="number" min="0" placeholder="0" />
          </div>

          {/* Preguntas de riesgo */}
          {preguntas.length > 0 && (
            <div className="border border-sig-200 rounded-xl p-4 space-y-3 bg-sig-50/30">
              <p className="text-xs font-semibold text-sig-700 uppercase tracking-wider">
                Condiciones del establecimiento
              </p>
              <p className="text-xs text-gray-500">
                Respondé las siguientes preguntas para identificar qué requisitos legales aplican.
              </p>
              {preguntas.map(p => (
                <input key={`pid_${p.id}`} type="hidden" name="pregunta_ids" value={p.id} />
              ))}
              <div className="space-y-2.5">
                {preguntas.map(p => (
                  <label key={p.id} className="flex items-start gap-3 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      name={`resp_${p.id}`}
                      value="true"
                      checked={respuestas[p.id] ?? false}
                      onChange={e => setRespuestas(prev => ({ ...prev, [p.id]: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-sig-500 focus:ring-sig-400 shrink-0"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{p.texto}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          Contacto — todos los tipos
      ════════════════════════════════════════════════════ */}
      {selectedTipoId && (
        <>
          {isSubcontratista && <SectionTitle>Contacto</SectionTitle>}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" name="email" type="email" placeholder="correo@ejemplo.com" />
            <Input label="Teléfono" name="telefono" placeholder="+54 11 0000-0000" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {isSubcontratista ? 'Información general' : 'Notas'}
            </label>
            <textarea
              name={isSubcontratista ? 'informacion_general' : 'notas'}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
              placeholder={isSubcontratista ? 'Descripción, notas o información adicional…' : 'Notas opcionales…'}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => history.back()}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
