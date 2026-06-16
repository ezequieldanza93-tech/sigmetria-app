'use client'

import { useActionState, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { INCIDENTE_TIPO_OPTIONS } from '@/lib/constants'
import { TIPO_PERSONA_INCIDENTE_LABELS } from '@/lib/constants'
import { PersonaSelectorConAlta } from '@/components/persona-selector-con-alta'
import { PersonaMultiSelectConSueltos, type PersonaMultiSelectValue } from '@/components/persona-multiselect'
import type { ActionResult } from '@/lib/types'

const EMPTY_VINCULOS: PersonaMultiSelectValue = { personaIds: [], sueltos: [] }

type Action = (
  prev: ActionResult<null> | null,
  fd: FormData
) => Promise<ActionResult<null>>

interface Props {
  action: Action
  onSuccess: () => void
  establecimientoId: string
}

export function IncidenteForm({ action, onSuccess, establecimientoId }: Props) {
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [tipoPersona, setTipoPersona] = useState<string>('trabajador_interno')
  const [involucrados, setInvolucrados] = useState<PersonaMultiSelectValue>(EMPTY_VINCULOS)
  const [testigos, setTestigos] = useState<PersonaMultiSelectValue>(EMPTY_VINCULOS)
  const [fechaBaja, setFechaBaja] = useState('')
  const [fechaAlta, setFechaAlta] = useState('')
  const [diasCalculados, setDiasCalculados] = useState<number | null>(null)

  const calcularDias = useCallback(() => {
    if (fechaBaja && fechaAlta) {
      const diff = Math.floor((new Date(fechaAlta).getTime() - new Date(fechaBaja).getTime()) / (1000 * 60 * 60 * 24))
      setDiasCalculados(diff >= 0 ? diff : 0)
    } else {
      setDiasCalculados(null)
    }
  }, [fechaBaja, fechaAlta])

  useEffect(() => { calcularDias() }, [calcularDias])

  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<null> | null, fd: FormData) => {
      const result = await action(prev, fd)
      if (result.success) {
        setPersonaId(null)
        setInvolucrados(EMPTY_VINCULOS)
        setTestigos(EMPTY_VINCULOS)
        onSuccess()
      }
      return result
    },
    null
  )

  return (
    <form action={formAction} className="space-y-4 max-md:space-y-6">
      {state && !state.success && (
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="incidente-tipo" className="text-xs text-text-secondary block mb-1">Tipo *</label>
        <select id="incidente-tipo" name="tipo" required className="w-full border border-border-default rounded px-3 py-2 text-sm bg-surface-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]">
          <option value="">Seleccioná…</option>
          {INCIDENTE_TIPO_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="incidente-tipo-persona" className="text-xs text-text-secondary block mb-1">Tipo de persona</label>
        <select id="incidente-tipo-persona" name="tipo_persona" value={tipoPersona} onChange={e => setTipoPersona(e.target.value)}
          className="w-full border border-border-default rounded px-3 py-2 text-sm bg-surface-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]">
          {Object.entries(TIPO_PERSONA_INCIDENTE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <PersonaSelectorConAlta
        label="Persona afectada"
        name="persona_id"
        value={personaId}
        onChange={p => setPersonaId(p?.id ?? null)}
        establecimientoId={establecimientoId}
        esExterna={tipoPersona === 'trabajador_externo'}
        placeholder="Seleccioná o creá la persona afectada…"
      />

      <Input label="Fecha de ocurrencia *" name="fecha_ocurrencia" type="date" required
        defaultValue={new Date().toISOString().split('T')[0]} />

      <Input label="Hora de ocurrencia" name="hora_ocurrencia" type="time" />

      <Textarea label="Descripción" name="descripcion" placeholder="Breve descripción del incidente…" rows={3} />

      <div className="border-t border-border-subtle pt-4 space-y-4">
        <p className="text-sm font-medium text-text-secondary">Personas vinculadas</p>
        <PersonaMultiSelectConSueltos
          label="Involucrados"
          value={involucrados}
          onChange={setInvolucrados}
          establecimientoId={establecimientoId}
          placeholder="Agregar involucrados…"
        />
        <input type="hidden" name="involucrados_persona_ids" value={JSON.stringify(involucrados.personaIds)} />
        <input type="hidden" name="involucrados_sueltos" value={JSON.stringify(involucrados.sueltos)} />

        <PersonaMultiSelectConSueltos
          label="Testigos"
          value={testigos}
          onChange={setTestigos}
          establecimientoId={establecimientoId}
          placeholder="Agregar testigos…"
        />
        <input type="hidden" name="testigos_persona_ids" value={JSON.stringify(testigos.personaIds)} />
        <input type="hidden" name="testigos_sueltos" value={JSON.stringify(testigos.sueltos)} />
      </div>

      <div className="border-t border-border-subtle pt-4">
        <p className="text-sm font-medium text-text-secondary mb-3">Datos médicos</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Fecha baja médica" name="fecha_baja_medica" type="date"
            value={fechaBaja} onChange={e => setFechaBaja(e.target.value)} />
          <Input label="Fecha alta médica" name="fecha_alta_medica" type="date"
            value={fechaAlta} onChange={e => setFechaAlta(e.target.value)} />
        </div>
        {diasCalculados !== null && (
          <p className="text-xs text-text-secondary mt-1">
            Días perdidos (calculado): <strong className="text-text-primary">{diasCalculados} días</strong>
          </p>
        )}
      </div>

      <Input label="Días perdidos (manual)" name="dias_perdidos" type="number" min="0" placeholder="Solo si no tenés fechas médicas" />

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input name="tiene_denuncia_adjunta" type="checkbox" value="true" className="rounded" />
          Denuncia adjunta
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input name="tiene_evolucion_medica" type="checkbox" value="true" className="rounded" />
          Evolución médica adjunta
        </label>
      </div>

      <div className="border-t border-border-subtle pt-4 space-y-3">
        <p className="text-sm font-medium text-text-secondary">Adjuntos</p>
        <div>
          <label htmlFor="incidente-denuncia-adjuntos" className="text-xs text-text-secondary block mb-1">
            Denuncia del accidente / enfermedad profesional
          </label>
          <input
            id="incidente-denuncia-adjuntos"
            name="denuncia_adjuntos"
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="w-full text-sm text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm file:text-text-primary hover:file:bg-surface-base"
          />
        </div>
        <div>
          <label htmlFor="incidente-investigacion-adjuntos" className="text-xs text-text-secondary block mb-1">
            Investigación del accidente
          </label>
          <input
            id="incidente-investigacion-adjuntos"
            name="investigacion_adjuntos"
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="w-full text-sm text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm file:text-text-primary hover:file:bg-surface-base"
          />
        </div>
      </div>

      <div>
        <label htmlFor="incidente-requiere-derivacion" className="text-xs text-text-secondary block mb-1">Requiere derivación</label>
        <select id="incidente-requiere-derivacion" name="requiere_derivacion" className="w-full border border-border-default rounded px-3 py-2 text-sm bg-surface-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]">
          <option value="">No</option>
          <option value="true">Sí</option>
        </select>
      </div>

      <Textarea label="Acciones correctivas" name="acciones_correctivas" placeholder="Acciones tomadas…" rows={3} />

      <div className="flex flex-wrap gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Registrar Incidente'}
        </Button>
      </div>
    </form>
  )
}
