'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import {
  CANAL_ACCENT,
  CANAL_LABELS,
  ESTADO_LABELS,
  type CanalSlug,
  type ContenidoCanal,
  type ContenidoPublicacionFull,
} from '@/lib/contenido/types'

interface ContenidoCalendarProps {
  publicaciones: ContenidoPublicacionFull[]
  canales: ContenidoCanal[]
  getUrl: (pathOrUrl: string | null | undefined) => string | null
  onOpen: (pub: ContenidoPublicacionFull) => void
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Clave local YYYY-MM-DD de una fecha (sin corrimiento de timezone). */
function localKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ContenidoCalendar({ publicaciones, canales, getUrl, onOpen }: ContenidoCalendarProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-11
  const [filtro, setFiltro] = useState<CanalSlug | 'todos'>('todos')

  // Publicaciones con fecha, agrupadas por día local, aplicando el filtro de canal.
  const porDia = useMemo(() => {
    const map = new Map<string, ContenidoPublicacionFull[]>()
    for (const pub of publicaciones) {
      if (!pub.fecha_programada) continue
      if (filtro !== 'todos' && pub.canal.slug !== filtro) continue
      const d = new Date(pub.fecha_programada)
      if (Number.isNaN(d.getTime())) continue
      const key = localKey(d)
      const arr = map.get(key) ?? []
      arr.push(pub)
      map.set(key, arr)
    }
    return map
  }, [publicaciones, filtro])

  // Construcción de la grilla: lunes como primer día.
  const celdas = useMemo(() => {
    const primero = new Date(year, month, 1)
    // getDay(): 0=Dom … 6=Sáb. Queremos offset con lunes primero.
    const offset = (primero.getDay() + 6) % 7
    const diasEnMes = new Date(year, month + 1, 0).getDate()
    const items: (Date | null)[] = []
    for (let i = 0; i < offset; i++) items.push(null)
    for (let d = 1; d <= diasEnMes; d++) items.push(new Date(year, month, d))
    while (items.length % 7 !== 0) items.push(null)
    return items
  }, [year, month])

  function cambiarMes(delta: number) {
    const nuevo = new Date(year, month + delta, 1)
    setYear(nuevo.getFullYear())
    setMonth(nuevo.getMonth())
  }

  const hoyKey = localKey(today)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            className="rounded-lg border border-border-default p-1.5 text-text-secondary hover:bg-surface-elevated"
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="min-w-[10rem] text-center text-sm font-semibold text-text-primary">
            {MESES[month]} {year}
          </h3>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            className="rounded-lg border border-border-default p-1.5 text-text-secondary hover:bg-surface-elevated"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="w-56">
          <Select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as CanalSlug | 'todos')}
            options={[
              { value: 'todos', label: 'Todos los canales' },
              ...canales.map((c) => ({ value: c.slug, label: c.nombre })),
            ]}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-elevated">
          {DIAS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-text-tertiary">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((fecha, i) => {
            const key = fecha ? localKey(fecha) : null
            const eventos = key ? porDia.get(key) ?? [] : []
            const esHoy = key === hoyKey
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[92px] border-b border-r border-border-subtle p-1.5 last:border-r-0',
                  !fecha && 'bg-surface-sunken/40',
                )}
              >
                {fecha && (
                  <>
                    <div
                      className={cn(
                        'mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs',
                        esHoy ? 'bg-brand-primary font-semibold text-white' : 'text-text-tertiary',
                      )}
                    >
                      {fecha.getDate()}
                    </div>
                    <div className="space-y-1">
                      {eventos.slice(0, 3).map((pub) => {
                        const thumb = getUrl(pub.media[0]?.storage_path)
                        return (
                          <button
                            key={pub.id}
                            type="button"
                            onClick={() => onOpen(pub)}
                            title={`${CANAL_LABELS[pub.canal.slug]} · ${pub.titulo} · ${ESTADO_LABELS[pub.estado.slug]}`}
                            className="flex w-full items-center gap-1 rounded bg-surface-elevated px-1 py-0.5 text-left hover:bg-surface-sunken"
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: CANAL_ACCENT[pub.canal.slug] }}
                            />
                            {thumb && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />
                            )}
                            <span className="truncate text-[11px] text-text-primary">{pub.titulo}</span>
                          </button>
                        )
                      })}
                      {eventos.length > 3 && (
                        <p className="px-1 text-[10px] text-text-tertiary">+{eventos.length - 3} más</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
