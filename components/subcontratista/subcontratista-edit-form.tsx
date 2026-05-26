'use client'

import { useActionState, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import {
  useSubcontratistaRubros,
  useArtOrgs,
  useLocalidades,
  useEstablecimientoTipos,
} from '@/lib/queries/organizacion'
import type { ActionResult, PreguntaRiesgo } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrgFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<null>>

interface Props {
  action: OrgFormAction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sub: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preguntas: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  respuestas: any[]
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border-subtle pt-5 mt-5">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">{children}</h3>
    </div>
  )
}

export function SubcontratistaEditForm({ action, sub, preguntas, respuestas }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  const org = sub.organizaciones_externas ?? {}
  const localidad = org.localidades ?? {}

  const { data: rubros = [] } = useSubcontratistaRubros(true)
  const { data: localidades = [] } = useLocalidades(true)
  const { data: tiposEst = [] } = useEstablecimientoTipos(true)
  const { data: artOrgs = [] } = useArtOrgs(true)

  const [selectedProvincia, setSelectedProvincia] = useState(localidad.provincia ?? '')
  const [selectedLocalidadId, setSelectedLocalidadId] = useState(org.localidad_id ?? '')
  const [selectedArtId, setSelectedArtId] = useState(sub.art_id ?? '')
  const [selectedTipoEstId, setSelectedTipoEstId] = useState(sub.tipo_establecimiento_id ?? '')

  // Load preguntas when tipo_establecimiento changes
  const [preguntasDinamicas, setPreguntasDinamicas] = useState<PreguntaRiesgo[]>(preguntas ?? [])
  const [respuestasState, setRespuestasState] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {}
      ;(respuestas ?? []).forEach((r: { pregunta_id: string; respuesta: boolean }) => {
        initial[r.pregunta_id] = r.respuesta
      })
      return initial
    }
  )

  useEffect(() => {
    if (!selectedTipoEstId) { setPreguntasDinamicas([]); return }
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
        setPreguntasDinamicas(ps as PreguntaRiesgo[])
      })
  }, [selectedTipoEstId])

  const provincias = [...new Set(localidades.map(l => l.provincia))].sort()
  const localidadesFiltradas = localidades.filter(l => l.provincia === selectedProvincia)

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      {/* ── Nombre ── */}
      <Input
        label="Razón Social *"
        name="nombre"
        required
        defaultValue={org.nombre ?? ''}
        placeholder="Constructora S.A."
      />

      {/* ── Identificación ── */}
      <div className="grid grid-cols-3 gap-4">
        <Select
          label="Tipo identidad impositiva"
          name="tipo_identidad_impositiva"
          defaultValue={org.tipo_identidad_impositiva ?? ''}
          options={[
            { value: 'CUIT', label: 'CUIT' },
            { value: 'CUIL', label: 'CUIL' },
            { value: 'CDI', label: 'CDI' },
          ]}
          placeholder="—"
        />
        <Input label="CUIT" name="cuit" defaultValue={org.cuit ?? ''} placeholder="20-12345678-9" />
        <Select
          label="Rubro *"
          name="rubro_id"
          defaultValue={sub.rubro_id ?? ''}
          required
          options={rubros.map(r => ({ value: r.id, label: r.nombre }))}
          placeholder="Seleccionar rubro…"
        />
      </div>

      {/* ── Ubicación ── */}
      <SectionTitle>Ubicación</SectionTitle>
      <Input label="Domicilio" name="domicilio" defaultValue={org.domicilio ?? ''} placeholder="Av. Corrientes 1234" />
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
      <Input label="Código Postal" name="codigo_postal" defaultValue={org.codigo_postal ?? ''} placeholder="1001" className="w-32" />

      {/* ── ART ── */}
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
        <Input label="Nº de contrato ART" name="art_numero_contrato" defaultValue={sub.art_numero_contrato ?? ''} placeholder="Nº de contrato" />
      </div>

      {/* ── Actividad ── */}
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
          {tiposEst.map((t: { id: string; nombre: string; codigo: string }) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        {tiposEst.find((t: { id: string; codigo: string }) => t.id === selectedTipoEstId)?.codigo === 'CONSTRUCCION' && (
          <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Requiere aviso de inicio de obra según normativa vigente.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Actividad Principal" name="actividad_principal" defaultValue={sub.actividad_principal ?? ''} placeholder="Construcción de obras civiles" />
        <Input label="Cantidad de Trabajadores" name="cantidad_trabajadores" type="number" min="0" defaultValue={sub.cantidad_trabajadores ?? ''} placeholder="0" />
      </div>

      {/* ── Preguntas de riesgo ── */}
      {preguntasDinamicas.length > 0 && (
        <div className="border border-sig-200 rounded-xl p-4 space-y-3 bg-sig-50/30">
          <p className="text-xs font-semibold text-sig-700 uppercase tracking-wider">
            Condiciones del establecimiento
          </p>
          <p className="text-xs text-text-secondary">
            Respondé las siguientes preguntas para identificar qué requisitos legales aplican.
          </p>
          {preguntasDinamicas.map(p => (
            <input key={`pid_${p.id}`} type="hidden" name="pregunta_ids" value={p.id} />
          ))}
          <div className="space-y-2.5">
            {preguntasDinamicas.map(p => (
              <label key={p.id} className="flex items-start gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  name={`resp_${p.id}`}
                  value="true"
                  checked={respuestasState[p.id] ?? false}
                  onChange={e => setRespuestasState(prev => ({ ...prev, [p.id]: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 rounded border-border-default text-sig-500 focus:ring-sig-400 shrink-0"
                />
                <span className="text-sm text-text-secondary group-hover:text-text-primary">{p.texto}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Contacto ── */}
      <SectionTitle>Contacto</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Email" name="email" type="email" defaultValue={org.email ?? ''} placeholder="correo@ejemplo.com" />
        <Input label="Teléfono" name="telefono" defaultValue={org.telefono ?? ''} placeholder="+54 11 0000-0000" />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Información general</label>
        <textarea
          name="informacion_general"
          rows={3}
          defaultValue={sub.informacion_general ?? ''}
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
          placeholder="Descripción, notas o información adicional…"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar Cambios'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
