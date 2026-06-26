'use client'

import { useActionState, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { PhoneInput } from '@/components/forms/phone-input'
import { createClient } from '@/lib/supabase/client'
import {
  useOrganizacionTipos,
  useSubcontratistaRubros,
  useArtOrgs,
  useLocalidades,
  useEstablecimientoTipos,
} from '@/lib/queries/organizacion'
import type {
  ActionResult,
  PreguntaRiesgo,
} from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrgFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<null>>

interface Props {
  action: OrgFormAction
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border-subtle pt-5 mt-5">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">{children}</h3>
    </div>
  )
}

export function OrganizacionExternaForm({ action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  const [selectedTipoId, setSelectedTipoId] = useState('')
  const [selectedTipoNombre, setSelectedTipoNombre] = useState('')

  const isSubcontratista = selectedTipoNombre === 'Subcontratista'

  const { data: tiposOrg = [] } = useOrganizacionTipos()
  const { data: rubros = [] } = useSubcontratistaRubros(isSubcontratista)
  const { data: localidades = [] } = useLocalidades(isSubcontratista)
  const { data: tiposEst = [] } = useEstablecimientoTipos(isSubcontratista)
  const { data: artOrgs = [] } = useArtOrgs(isSubcontratista)

  const [preguntas, setPreguntas] = useState<PreguntaRiesgo[]>([])
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>({})
  const [selectedRubroId, setSelectedRubroId] = useState('')
  const [selectedProvincia, setSelectedProvincia] = useState('')
  const [selectedLocalidadId, setSelectedLocalidadId] = useState('')
  const [selectedArtId, setSelectedArtId] = useState('')
  const [selectedTipoEstId, setSelectedTipoEstId] = useState('')
  const [infoONotas, setInfoONotas] = useState('')

  // Alta inline de ART (mismo patrón que empresa-form en modo creación): no hay
  // entidad todavía, así que guardamos el nombre en estado, lo mostramos como
  // opción seleccionable y la server action lo resuelve a un id al guardar.
  const [showAddArt, setShowAddArt] = useState(false)
  const [newArtName, setNewArtName] = useState('')
  const [newArtPreview, setNewArtPreview] = useState<string | null>(null)

  // Load preguntas when tipo_establecimiento changes
  useEffect(() => {
    if (!selectedTipoEstId) { setPreguntas([]); return }
    createClient()
      .from('preguntas_tipos')
      .select('pregunta_id, orden, riesgos_preguntas!pregunta_id(id, codigo, texto, orden, is_active)')
      .eq('tipo_id', selectedTipoEstId)
      .order('orden')
      .then(({ data }) => {
        if (!data) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = (data as any[]).map(r => r.riesgos_preguntas).filter(Boolean)
          .sort((a: PreguntaRiesgo, b: PreguntaRiesgo) => a.orden - b.orden)
        setPreguntas(ps as PreguntaRiesgo[])
      })
  }, [selectedTipoEstId])

  function handleTipoChange(id: string) {
    const tipo = tiposOrg.find(t => t.id === id)
    setSelectedTipoId(id)
    setSelectedTipoNombre(tipo?.nombre ?? '')
    // Reset subcontratista state when changing tipo
    setSelectedRubroId('')
    setSelectedProvincia('')
    setSelectedLocalidadId('')
    setSelectedArtId('')
    setSelectedTipoEstId('')
    setPreguntas([])
    setRespuestas({})
    setShowAddArt(false)
    setNewArtName('')
    setNewArtPreview(null)
  }

  function handleAddArt() {
    const nombre = newArtName.trim()
    if (!nombre) return
    // Sin entidad creada todavía: guardamos el nombre como "preview". La server
    // action lo crea y enlaza al guardar (mirroring empresa-form en alta).
    setNewArtPreview(nombre)
    setSelectedArtId('__new__')
    setNewArtName('')
    setShowAddArt(false)
  }

  const provincias = [...new Set(localidades.map(l => l.provincia))].sort()
  const localidadesFiltradas = localidades.filter(l => l.provincia === selectedProvincia)

  return (
    <form action={formAction} className="space-y-4 max-md:space-y-6">
      {/* hidden fields for server action */}
      <input type="hidden" name="tipo_nombre" value={selectedTipoNombre} />

      {state && !state.success && (
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      {/* ── Tipo ─────────────────────────────────────────────── */}
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Tipo de organización *</label>
        <select
          name="tipo_id"
          value={selectedTipoId}
          onChange={e => handleTipoChange(e.target.value)}
          required
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <SearchableSelect
              label="Rubro *"
              name="rubro_id"
              required
              value={selectedRubroId}
              onChange={setSelectedRubroId}
              options={rubros.map(r => ({ value: r.id, label: r.nombre }))}
              placeholder="Seleccionar rubro…"
            />
          </div>

          {/* Ubicación */}
          <SectionTitle>Ubicación</SectionTitle>
          <Input label="Domicilio" name="domicilio" placeholder="Av. Corrientes 1234" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect
              label="Provincia"
              value={selectedProvincia}
              onChange={v => { setSelectedProvincia(v); setSelectedLocalidadId('') }}
              options={provincias.map(p => ({ value: p, label: p }))}
              placeholder="Seleccionar provincia…"
            />
            <SearchableSelect
              label="Localidad"
              name="localidad_id"
              value={selectedLocalidadId}
              onChange={setSelectedLocalidadId}
              options={localidadesFiltradas.map(l => ({ value: l.id, label: l.nombre }))}
              placeholder={selectedProvincia ? 'Seleccionar localidad…' : 'Elegí provincia primero'}
              disabled={!selectedProvincia}
            />
          </div>
          <Input label="Código Postal" name="codigo_postal" placeholder="1001" className="w-32" />

          {/* ART */}
          <SectionTitle>ART</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                label="ART"
                name="art_id"
                value={selectedArtId}
                onChange={e => setSelectedArtId(e.target.value)}
                options={[
                  ...artOrgs.map(o => ({ value: o.id, label: o.nombre })),
                  ...(newArtPreview ? [{ value: '__new__', label: `${newArtPreview} (nueva)` }] : []),
                ]}
                placeholder="Seleccionar ART…"
              />
              {newArtPreview && (
                <input type="hidden" name="new_art_nombre" value={newArtPreview} />
              )}
              {!showAddArt && !newArtPreview && (
                <button
                  type="button"
                  onClick={() => setShowAddArt(true)}
                  className="mt-1 text-xs text-sig-500 hover:text-sig-700 hover:underline"
                >
                  + No encontrás tu ART? Agregar nueva
                </button>
              )}
              {newArtPreview && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-sig-50 border border-sig-200 rounded-lg">
                  <span className="text-xs text-sig-700 flex-1">Nueva ART: <strong>{newArtPreview}</strong></span>
                  <button
                    type="button"
                    onClick={() => { setNewArtPreview(null); setSelectedArtId('') }}
                    className="text-xs text-text-tertiary hover:text-danger transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
              {showAddArt && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={newArtName}
                    onChange={e => setNewArtName(e.target.value)}
                    placeholder="Nombre de la ART…"
                    className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddArt() } }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddArt}
                      disabled={!newArtName.trim()}
                      className="text-xs bg-sig-500 hover:bg-sig-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddArt(false); setNewArtName('') }}
                      className="text-xs text-text-secondary hover:text-text-secondary px-3 py-1.5 rounded-lg border border-border-subtle transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Input label="Nº de contrato ART" name="art_numero_contrato" placeholder="Nº de contrato" />
          </div>

          {/* Actividad */}
          <SectionTitle>Actividad y establecimiento</SectionTitle>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Tipo de establecimiento</label>
            <select
              name="tipo_establecimiento_id"
              value={selectedTipoEstId}
              onChange={e => setSelectedTipoEstId(e.target.value)}
              className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Actividad Principal" name="actividad_principal" placeholder="Construcción de obras civiles" />
            <Input label="Cantidad de Trabajadores" name="cantidad_trabajadores" type="number" min="0" placeholder="0" />
          </div>

          {/* Preguntas de riesgo */}
          {preguntas.length > 0 && (
            <div className="border border-sig-200 rounded-xl p-4 space-y-3 bg-sig-50/30">
              <p className="text-xs font-semibold text-sig-700 uppercase tracking-wider">
                Condiciones del establecimiento
              </p>
              <p className="text-xs text-text-secondary">
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
                      className="w-4 h-4 mt-0.5 rounded border-border-default text-sig-500 focus:ring-sig-400 shrink-0"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary">{p.texto}</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Email" name="email" type="email" placeholder="correo@ejemplo.com" />
            <PhoneInput name="telefono" label="Teléfono" placeholder="+54 11 0000-0000" />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">
              {isSubcontratista ? 'Información general' : 'Notas'}
            </label>
            <VoiceTextarea
              name={isSubcontratista ? 'informacion_general' : 'notas'}
              value={infoONotas}
              onValueChange={setInfoONotas}
              rows={3}
              className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
              placeholder={isSubcontratista ? 'Descripción, notas o información adicional…' : 'Notas opcionales…'}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
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
