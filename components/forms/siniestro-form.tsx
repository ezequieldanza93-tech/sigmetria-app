'use client'

import { useActionState, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { SINIESTRO_TIPO_OPTIONS } from '@/lib/constants'
import { TIPO_PERSONA_SINIESTRO_LABELS } from '@/lib/constants'
import type { ActionResult, DirectorioPersona } from '@/lib/types'

type Action = (
  prev: ActionResult<null> | null,
  fd: FormData
) => Promise<ActionResult<null>>

interface Props {
  action: Action
  onSuccess: () => void
  establecimientoId: string
}

export function SiniestroForm({ action, onSuccess, establecimientoId }: Props) {
  const [personas, setPersonas] = useState<DirectorioPersona[]>([])
  const [tipoPersona, setTipoPersona] = useState<string>('trabajador_interno')
  const [fechaBaja, setFechaBaja] = useState('')
  const [fechaAlta, setFechaAlta] = useState('')
  const [diasCalculados, setDiasCalculados] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('personas_establecimientos')
      .select('personas_directorio(id, nombre, apellido, dni)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { personas_directorio: DirectorioPersona }[])
          .map(r => r.personas_directorio)
          .filter(Boolean)
        setPersonas(list)
      })
  }, [establecimientoId])

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
      if (result.success) onSuccess()
      return result
    },
    null
  )

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div>
        <label className="text-xs text-gray-600 block mb-1">Tipo *</label>
        <select name="tipo" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
          <option value="">Seleccioná…</option>
          {SINIESTRO_TIPO_OPTIONS.filter(o => o.value !== '').map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-600 block mb-1">Tipo de persona</label>
        <select name="tipo_persona" value={tipoPersona} onChange={e => setTipoPersona(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
          {Object.entries(TIPO_PERSONA_SINIESTRO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-600 block mb-1">Persona afectada</label>
        <select name="persona_id" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
          <option value="">Seleccioná…</option>
          {personas.map(p => (
            <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} {p.dni ? `- DNI: ${p.dni}` : ''}</option>
          ))}
        </select>
      </div>

      <Input label="Fecha de ocurrencia *" name="fecha_ocurrencia" type="date" required
        defaultValue={new Date().toISOString().split('T')[0]} />

      <Input label="Hora de ocurrencia" name="hora_ocurrencia" type="time" />

      <Textarea label="Descripción" name="descripcion" placeholder="Breve descripción del siniestro…" rows={3} />

      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Datos médicos</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha baja médica" name="fecha_baja_medica" type="date"
            value={fechaBaja} onChange={e => setFechaBaja(e.target.value)} />
          <Input label="Fecha alta médica" name="fecha_alta_medica" type="date"
            value={fechaAlta} onChange={e => setFechaAlta(e.target.value)} />
        </div>
        {diasCalculados !== null && (
          <p className="text-xs text-gray-500 mt-1">
            Días perdidos (calculado): <strong className="text-gray-800">{diasCalculados} días</strong>
          </p>
        )}
      </div>

      <Input label="Días perdidos (manual)" name="dias_perdidos" type="number" min="0" placeholder="Solo si no tenés fechas médicas" />

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input name="tiene_denuncia_adjunta" type="checkbox" value="true" className="rounded" />
          Denuncia adjunta
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input name="tiene_evolucion_medica" type="checkbox" value="true" className="rounded" />
          Evolución médica adjunta
        </label>
      </div>

      <div>
        <label className="text-xs text-gray-600 block mb-1">Requiere derivación</label>
        <select name="requiere_derivacion" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
          <option value="">No</option>
          <option value="true">Sí</option>
        </select>
      </div>

      <Textarea label="Acciones correctivas" name="acciones_correctivas" placeholder="Acciones tomadas…" rows={3} />

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Registrar Siniestro'}
        </Button>
      </div>
    </form>
  )
}
