'use client'

import { useState, useEffect, useActionState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcularEstadoGestion } from '@/lib/types'
import type { EstadoGestion, Gestion, GestionEstablecimiento, RegistroGestion, Riesgo, RiesgoNivel } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { planificarGestion } from '@/lib/actions/gestion-establecimiento'
import { RIESGO_NIVEL_LABELS } from '@/lib/constants'
import { RIESGO_NIVEL_COLORS } from '@/lib/types'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const ESTADO_COLORS: Record<EstadoGestion, string> = {
  Ejecutado: 'bg-sig-50 text-sig-700',
  Pendiente: 'bg-red-100 text-red-700',
  Planificado: 'bg-gray-100 text-gray-600',
}

interface FullRegistro extends RegistroGestion {
  ge_gestion_nombre?: string
  ge_categoria_nombre?: string
  ge_grupo_nombre?: string
  ge_id?: string
}

interface GestionConJoin extends Omit<GestionEstablecimiento, 'gestiones'> {
  gestiones?: {
    id: string
    nombre: string
    categoria_gestiones?: {
      nombre: string
      grupo_gestiones?: { nombre: string } | null
    } | null
  } | null
}

interface GestionesAgendaProps {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  riesgos: Riesgo[]
}

// ---- Modal: Planificar Nueva Gestión ----
function PlanificarModal({
  establecimientoId,
  todasGestiones,
  onClose,
  onSuccess,
}: {
  establecimientoId: string
  todasGestiones: Gestion[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(planificarGestion, null)

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state])

  const byGrupo = new Map<string, { cat: string; g: Gestion }[]>()
  for (const g of todasGestiones) {
    const grupo = (g as GestionConJoin & { categoria_gestiones?: { nombre: string; grupo_gestiones?: { nombre: string } | null } | null }).categoria_gestiones?.grupo_gestiones?.nombre ?? 'Sin grupo'
    const cat = (g as GestionConJoin & { categoria_gestiones?: { nombre: string; grupo_gestiones?: { nombre: string } | null } | null }).categoria_gestiones?.nombre ?? 'Sin categoría'
    if (!byGrupo.has(grupo)) byGrupo.set(grupo, [])
    byGrupo.get(grupo)!.push({ cat, g })
  }

  return (
    <Modal title="Planificar Nueva Gestión" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="establecimiento_id" value={establecimientoId} />

        {state && !state.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {state.error}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Gestión *</label>
          <select
            name="gestion_id"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
          >
            <option value="">Seleccionar gestión…</option>
            {Array.from(byGrupo.entries()).map(([grupo, items]) => (
              <optgroup key={grupo} label={grupo}>
                {items.map(({ cat, g }) => (
                  <option key={g.id} value={g.id}>{cat} › {g.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Fecha Planificada *</label>
          <input
            type="date"
            name="fecha_planificada"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
          <textarea
            name="notas"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Planificar'}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Main component ----
export function GestionesAgenda({ establecimientoId, canWrite, riesgos }: GestionesAgendaProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  )
  const [filterEstado, setFilterEstado] = useState<'' | EstadoGestion>('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [orderByCategoria, setOrderByCategoria] = useState(false)
  const [registros, setRegistros] = useState<FullRegistro[] | null>(null)
  const [todasGestiones, setTodasGestiones] = useState<Gestion[]>([])
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showRiesgos, setShowRiesgos] = useState(false)

  function loadRegistros() {
    const supabase = createClient()
    supabase
      .from('gestion_establecimiento')
      .select('id, gestiones(id, nombre, categoria_gestiones(nombre, grupo_gestiones(nombre)))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data: geData }) => {
        const geIds = (geData ?? []).map((ge: GestionConJoin) => ge.id)
        if (geIds.length === 0) { setRegistros([]); return }
        const geMap = new Map<string, GestionConJoin>()
        for (const ge of geData as GestionConJoin[]) geMap.set(ge.id, ge)

        supabase
          .from('registro_gestiones')
          .select('*')
          .in('gestion_establecimiento_id', geIds)
          .gte('fecha_planificada', `${year}-01-01`)
          .lte('fecha_planificada', `${year}-12-31`)
          .order('fecha_planificada')
          .then(({ data: regData }) => {
            const full: FullRegistro[] = (regData ?? []).map((r: RegistroGestion) => {
              const ge = geMap.get(r.gestion_establecimiento_id)
              return {
                ...r,
                ge_id: ge?.id,
                ge_gestion_nombre: ge?.gestiones?.nombre,
                ge_categoria_nombre: ge?.gestiones?.categoria_gestiones?.nombre,
                ge_grupo_nombre: ge?.gestiones?.categoria_gestiones?.grupo_gestiones?.nombre,
              }
            })
            setRegistros(full)
          })
      })
  }

  useEffect(() => {
    loadRegistros()
    const supabase = createClient()
    supabase
      .from('gestiones')
      .select('*, categoria_gestiones(nombre, grupo_gestiones(nombre))')
      .order('nombre')
      .then(({ data }) => setTodasGestiones((data as unknown as Gestion[]) ?? []))
  }, [establecimientoId, year])

  const monthCounts = MONTHS.map((_, i) => {
    if (!registros) return 0
    const m = String(i + 1).padStart(2, '0')
    return registros.filter(r => r.fecha_planificada?.startsWith(`${year}-${m}`)).length
  })

  const filteredRegistros = (registros ?? []).filter(r => {
    const month = parseInt(r.fecha_planificada?.split('-')[1] ?? '0') - 1
    if (!selectedMonths.has(month)) return false
    const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)
    if (filterEstado && estado !== filterEstado) return false
    if (filterCategoria && r.ge_categoria_nombre !== filterCategoria) return false
    return true
  })

  const sortedRegistros = orderByCategoria
    ? [...filteredRegistros].sort((a, b) =>
        (a.ge_categoria_nombre ?? '').localeCompare(b.ge_categoria_nombre ?? '')
      )
    : filteredRegistros

  const categorias = Array.from(
    new Set((registros ?? []).map(r => r.ge_categoria_nombre).filter(Boolean))
  ).sort() as string[]

  const activeMonthLabel =
    selectedMonths.size === 12
      ? null
      : selectedMonths.size === 1
      ? MONTHS[Array.from(selectedMonths)[0]]
      : `${selectedMonths.size} meses`

  const activeRiesgos = riesgos.filter(r => !r.resuelto)

  return (
    <div>
      {/* Year navigation */}
      <div className="bg-gray-800 text-white rounded-xl px-6 py-4 mb-4 flex items-center justify-between">
        <button
          onClick={() => setYear(y => y - 1)}
          className="text-gray-400 hover:text-white text-sm font-medium w-12"
        >
          {year - 1}
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="text-gray-300 hover:text-white text-lg leading-none">
            ‹‹
          </button>
          <span className="text-base font-semibold tracking-wide">Agenda de Gestiones {year}</span>
          <button onClick={() => setYear(y => y + 1)} className="text-gray-300 hover:text-white text-lg leading-none">
            ››
          </button>
        </div>
        <button
          onClick={() => setYear(y => y + 1)}
          className="text-gray-400 hover:text-white text-sm font-medium w-12 text-right"
        >
          {year + 1}
        </button>
      </div>

      {/* Month tiles */}
      <div className="grid grid-cols-12 gap-1.5 mb-3">
        {MONTHS.map((m, i) => {
          const isSelected = selectedMonths.has(i)
          return (
            <button
              key={m}
              onClick={() =>
                setSelectedMonths(prev => {
                  const next = new Set(prev)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  return next
                })
              }
              className={`rounded-lg py-2 text-center transition-colors ${
                isSelected
                  ? 'bg-sig-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <div className="text-xs font-medium">{m}</div>
              <div className="text-xs opacity-80">{monthCounts[i]}</div>
            </button>
          )
        })}
      </div>

      {/* Select / Deselect all */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedMonths(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Seleccionar todos los meses
        </button>
        <button
          onClick={() => setSelectedMonths(new Set())}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Deseleccionar todos los meses
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value as '' | EstadoGestion)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
        >
          <option value="">Seleccione Estado</option>
          <option value="Planificado">Planificado</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Ejecutado">Ejecutado</option>
        </select>

        <select
          value={filterCategoria}
          onChange={e => setFilterCategoria(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
        >
          <option value="">Seleccione Categorías</option>
          {categorias.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button
          onClick={() => { setFilterEstado(''); setFilterCategoria(''); setOrderByCategoria(false) }}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Restablecer filtros
        </button>

        <button
          onClick={() => setOrderByCategoria(v => !v)}
          className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
            orderByCategoria
              ? 'border-sig-300 bg-sig-50 text-sig-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Ordenar por Categoría
        </button>

        {activeMonthLabel && (
          <span className="text-xs bg-sig-50 text-sig-700 border border-sig-200 rounded-lg px-3 py-1.5 font-medium">
            {activeMonthLabel}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-400">
            {registros !== null ? `${filteredRegistros.length} gestiones` : ''}
          </span>
          {canWrite && (
            <button
              onClick={() => setShowPlanModal(true)}
              className="text-sm font-semibold bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors"
            >
              Planificar Nueva Gestión
            </button>
          )}
        </div>
      </div>

      {/* Gestiones table */}
      {registros === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Cargando…
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No hay gestiones para el período seleccionado.
          {canWrite && (
            <button
              onClick={() => setShowPlanModal(true)}
              className="block mx-auto mt-3 text-sig-500 hover:text-sig-700 font-medium text-sm"
            >
              + Planificar una gestión
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-white text-left">
                <th className="px-5 py-3 font-medium">Gestión</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Grupo</th>
                <th className="px-5 py-3 font-medium">Fecha Planificada</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedRegistros.map(r => {
                const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{r.ge_gestion_nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{r.ge_categoria_nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{r.ge_grupo_nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{r.fecha_planificada}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_COLORS[estado]}`}
                      >
                        {estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Riesgos section */}
      <div className="border-t border-gray-200 pt-6">
        <button
          onClick={() => setShowRiesgos(v => !v)}
          className="flex items-center justify-between w-full text-left mb-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Riesgos</span>
            {activeRiesgos.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                {activeRiesgos.length} activos
              </span>
            )}
          </div>
          <span className="text-gray-400 text-sm">{showRiesgos ? '▲' : '▼'}</span>
        </button>

        {showRiesgos && (
          riesgos.length === 0 ? (
            <p className="text-sm text-gray-400">No hay riesgos registrados.</p>
          ) : (
            <div className="space-y-2">
              {riesgos.map(r => (
                <div
                  key={r.id}
                  className={`bg-white border rounded-xl px-4 py-3 flex items-start justify-between gap-4 ${
                    r.resuelto ? 'opacity-60 border-gray-100' : 'border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          RIESGO_NIVEL_COLORS[r.nivel as RiesgoNivel]
                        }`}
                      >
                        {RIESGO_NIVEL_LABELS[r.nivel as RiesgoNivel]}
                      </span>
                      {r.resuelto && (
                        <span className="text-xs text-gray-400">Resuelto</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-medium">{r.descripcion}</p>
                    {r.medida_correctiva && (
                      <p className="text-xs text-gray-500 mt-0.5">{r.medida_correctiva}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">{r.fecha_identificacion}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {showPlanModal && (
        <PlanificarModal
          establecimientoId={establecimientoId}
          todasGestiones={todasGestiones}
          onClose={() => setShowPlanModal(false)}
          onSuccess={() => {
            setShowPlanModal(false)
            loadRegistros()
          }}
        />
      )}
    </div>
  )
}
