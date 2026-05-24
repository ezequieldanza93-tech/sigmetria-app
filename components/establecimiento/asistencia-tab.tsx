'use client'

import { useState, useEffect, useActionState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { createAsistencia } from '@/lib/actions/asistencia'
import type { AsistenciaDiaria, DirectorioPersona, TipoHora } from '@/lib/types'

const TZ = 'America/Argentina/Buenos_Aires'

interface AsistenciaTabProps {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

export function AsistenciaTab({ establecimientoId, empresaId, canWrite }: AsistenciaTabProps) {
  const [registros, setRegistros] = useState<AsistenciaDiaria[] | null>(null)
  const [personas, setPersonas] = useState<DirectorioPersona[]>([])
  const [tiposHora, setTiposHora] = useState<TipoHora[]>([])
  const [showForm, setShowForm] = useState(false)
  const [horarioHoy, setHorarioHoy] = useState<{ inicio: string; fin: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
    const diaSemana = new Date().getDay()

    supabase
      .from('asistencia_diaria')
      .select('id, fecha, hora_entrada, hora_salida, tipo_hora_id, observaciones, personas_directorio(nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .eq('fecha', today)
      .order('hora_entrada', { ascending: true })
      .then(({ data }) => setRegistros((data as unknown as AsistenciaDiaria[]) ?? []))

    supabase
      .from('personas_establecimientos')
      .select('personas_directorio(id, nombre, apellido, personas_tipos(nombre))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { personas_directorio: DirectorioPersona }[]).map(r => r.personas_directorio).filter(Boolean)
        setPersonas(list)
      })

    supabase
      .from('establecimientos_horarios')
      .select('hora_inicio, hora_fin, activo')
      .eq('establecimiento_id', establecimientoId)
      .eq('dia_semana', diaSemana)
      .single()
      .then(({ data }) => {
        if (data?.activo && data.hora_inicio && data.hora_fin) {
          setHorarioHoy({ inicio: data.hora_inicio.slice(0, 5), fin: data.hora_fin.slice(0, 5) })
        }
      })

    supabase
      .from('tipos_horas')
      .select('id, nombre, color')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setTiposHora((data ?? []) as TipoHora[]))
  }, [establecimientoId])

  const [state, formAction, pending] = useActionState(
    createAsistencia.bind(null, establecimientoId, empresaId),
    null
  )

  useEffect(() => {
    if (state?.success) {
      setShowForm(false)
      setRegistros(null)
    }
  }, [state])

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Asistencia del día</h3>
        {canWrite && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>+ Registrar</Button>
        )}
      </div>

      {showForm && (
        <form action={formAction} className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-white">Nuevo registro de asistencia</p>
            {horarioHoy && (
              <span className="text-xs text-gray-400">
                Horario del establecimiento: {horarioHoy.inicio} – {horarioHoy.fin}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Persona *</label>
              <select name="persona_id" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                <option value="">Seleccioná…</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Fecha *</label>
              <input name="fecha" type="date" required defaultValue={today} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">
                Hora entrada *
                {horarioHoy && <span className="text-gray-400 font-normal ml-1">(default: {horarioHoy.inicio})</span>}
              </label>
              <input name="hora_entrada" type="time" required defaultValue={horarioHoy?.inicio ?? ''} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">
                Hora salida
                {horarioHoy && <span className="text-gray-400 font-normal ml-1">(default: {horarioHoy.fin})</span>}
              </label>
              <input name="hora_salida" type="time" defaultValue={horarioHoy?.fin ?? ''} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Tipo de hora</label>
              <select name="tipo_hora_id" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                <option value="">Default</option>
                {tiposHora.map(th => (
                  <option key={th.id} value={th.id}>{th.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Observaciones</label>
            <input name="observaciones" type="text" placeholder="Opcional…" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Registrar'}</Button>
          </div>
        </form>
      )}

      {registros === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">Cargando…</div>
      ) : registros.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Sin registros para hoy.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Persona</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Fecha</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Entrada</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Salida</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {registros.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {r.personas_directorio ? `${r.personas_directorio.apellido}, ${r.personas_directorio.nombre}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{r.fecha}</td>
                  <td className="px-5 py-3.5 text-gray-700">
                    {new Date(r.hora_entrada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {r.hora_salida ? new Date(r.hora_salida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {r.tipos_horas ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: (r.tipos_horas as unknown as { color: string }).color + '20', color: (r.tipos_horas as unknown as { color: string }).color }}>
                        {(r.tipos_horas as unknown as { nombre: string }).nombre}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
