'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ShieldCheck, ShieldAlert, History, Network, Search, Loader2,
  CheckCircle2, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import {
  verificarCadena, getHistorialEntidad, getFlujoPorTrace,
  type VerificacionCadena, type AuditTrailRow,
} from '@/lib/actions/auditoria'

// Tablas auditables (las que el trigger de trazabilidad SRT registra).
const TABLAS_AUDITABLES: { value: string; label: string }[] = [
  { value: 'gestiones_registros', label: 'Registros de gestiones' },
  { value: 'gestiones_observaciones', label: 'Observaciones de gestiones' },
  { value: 'gestiones_establecimientos', label: 'Gestiones por establecimiento' },
  { value: 'firmas', label: 'Firmas' },
  { value: 'empresas', label: 'Empresas' },
  { value: 'establecimientos', label: 'Establecimientos' },
  { value: 'incidentes', label: 'Incidentes' },
]

const ACCION_BADGE: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
}

type Tab = 'cadena' | 'historial' | 'flujo'

export function AuditoriaPanel() {
  const searchParams = useSearchParams()
  // Prefill por URL: ?tabla=&id= abre Historial; ?trace= abre Flujo.
  // Sin params, arranca como siempre en "Verificar cadena".
  const prefillTabla = searchParams.get('tabla') ?? ''
  const prefillId = searchParams.get('id') ?? ''
  const prefillTrace = searchParams.get('trace') ?? ''

  const tabInicial: Tab = prefillTrace
    ? 'flujo'
    : prefillTabla || prefillId
      ? 'historial'
      : 'cadena'

  const [tab, setTab] = useState<Tab>(tabInicial)

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'cadena', label: 'Verificar cadena', icon: ShieldCheck },
    { id: 'historial', label: 'Historial de entidad', icon: History },
    { id: 'flujo', label: 'Flujo por trace_id', icon: Network },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-primary/10 p-2.5">
          <ShieldCheck size={22} className="text-brand-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Auditoría y cadena de custodia</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Verificación de integridad y trazabilidad inmutable · SRT Disp. 15/2026 · Estándar 8
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center rounded-lg border border-border-default overflow-hidden w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-brand-primary text-white' : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'cadena' && <CadenaTab />}
      {tab === 'historial' && <HistorialTab prefillTabla={prefillTabla} prefillId={prefillId} />}
      {tab === 'flujo' && <FlujoTab prefillTrace={prefillTrace} />}
    </div>
  )
}

// ── Tab 1: Verificar cadena ──────────────────────────────────────────────────

function CadenaTab() {
  const [isPending, startTransition] = useTransition()
  const [resultado, setResultado] = useState<VerificacionCadena | null>(null)
  const { error: toastError } = useToast()

  function handleVerificar() {
    startTransition(async () => {
      const r = await verificarCadena()
      if (r.success) {
        setResultado(r.data)
      } else {
        setResultado(null)
        toastError(r.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-default p-5">
        <h2 className="text-sm font-medium text-text-primary">Integridad de la cadena de custodia</h2>
        <p className="text-xs text-text-tertiary mt-1 max-w-2xl">
          Cada evento auditado se encadena con un hash al evento anterior: si alguien
          alterara o borrara un registro del log, la cadena se rompe y queda en evidencia.
          Verificá que ningún eslabón haya sido manipulado.
        </p>
        <div className="mt-4">
          <Button onClick={handleVerificar} disabled={isPending}>
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {isPending ? 'Verificando…' : 'Verificar integridad'}
          </Button>
        </div>
      </div>

      {resultado && (
        resultado.estado === 'INTEGRA' ? (
          <div className="rounded-xl border border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40 p-5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={22} className="text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Cadena íntegra ✓</p>
                <p className="text-xs text-green-700/80 dark:text-green-400/80 mt-0.5">
                  Ningún eslabón del audit_log fue alterado. La trazabilidad es confiable.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={22} className="text-red-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  Cadena ALTERADA{resultado.primer_fallo_seq != null ? ` en seq ${resultado.primer_fallo_seq}` : ''}
                </p>
                {resultado.detalle && (
                  <p className="text-xs text-red-700/90 dark:text-red-400/90 mt-1">{resultado.detalle}</p>
                )}
                {resultado.primer_fallo_id && (
                  <p className="text-[11px] text-red-600/70 dark:text-red-400/70 mt-1 font-mono break-all">
                    Primer fallo: {resultado.primer_fallo_id}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ── Tab 2: Historial de entidad ──────────────────────────────────────────────

function HistorialTab({ prefillTabla = '', prefillId = '' }: { prefillTabla?: string; prefillId?: string }) {
  const [tabla, setTabla] = useState(prefillTabla)
  const [registroId, setRegistroId] = useState(prefillId)
  const [isPending, startTransition] = useTransition()
  const [filas, setFilas] = useState<AuditTrailRow[] | null>(null)
  const { error: toastError } = useToast()

  function buscar(tablaArg: string, registroIdArg: string) {
    startTransition(async () => {
      const r = await getHistorialEntidad(tablaArg, registroIdArg.trim())
      if (r.success) {
        setFilas(r.data)
      } else {
        setFilas(null)
        toastError(r.error)
      }
    })
  }

  function handleBuscar() {
    buscar(tabla, registroId)
  }

  // Prefill por URL: si llegamos con tabla + id, disparamos la búsqueda al montar.
  const autoBuscado = useRef(false)
  useEffect(() => {
    if (autoBuscado.current) return
    if (prefillTabla && prefillId.trim()) {
      autoBuscado.current = true
      buscar(prefillTabla, prefillId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-default p-5 space-y-4">
        <p className="text-xs text-text-tertiary max-w-2xl">
          Reconstruí el historial inmutable de un registro puntual: cada evento con su fecha,
          quién lo hizo y qué cambió (antes → después).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-3 sm:items-end">
          <Select
            label="Tabla"
            placeholder="Elegí una tabla…"
            options={TABLAS_AUDITABLES}
            value={tabla}
            onChange={e => setTabla(e.target.value)}
          />
          <Input
            label="ID del registro"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={registroId}
            onChange={e => setRegistroId(e.target.value)}
          />
          <Button onClick={handleBuscar} disabled={isPending || !tabla || !registroId.trim()}>
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Buscar
          </Button>
        </div>
      </div>

      <EventosTabla filas={filas} isPending={isPending} mostrarTabla={false} />
    </div>
  )
}

// ── Tab 3: Flujo por trace_id ────────────────────────────────────────────────

function FlujoTab({ prefillTrace = '' }: { prefillTrace?: string }) {
  const [traceId, setTraceId] = useState(prefillTrace)
  const [isPending, startTransition] = useTransition()
  const [filas, setFilas] = useState<AuditTrailRow[] | null>(null)
  const { error: toastError } = useToast()

  function buscar(traceIdArg: string) {
    startTransition(async () => {
      const r = await getFlujoPorTrace(traceIdArg.trim())
      if (r.success) {
        setFilas(r.data)
      } else {
        setFilas(null)
        toastError(r.error)
      }
    })
  }

  function handleBuscar() {
    buscar(traceId)
  }

  // Prefill por URL: si llegamos con ?trace=, reconstruimos el flujo al montar.
  const autoBuscado = useRef(false)
  useEffect(() => {
    if (autoBuscado.current) return
    if (prefillTrace.trim()) {
      autoBuscado.current = true
      buscar(prefillTrace)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-default p-5 space-y-4">
        <p className="text-xs text-text-tertiary max-w-2xl">
          Un <span className="font-medium">trace_id</span> agrupa todos los eventos de una misma
          operación, aunque toquen varias tablas. Reconstruí el flujo completo en orden cronológico.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 sm:items-end">
          <Input
            label="trace_id"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={traceId}
            onChange={e => setTraceId(e.target.value)}
          />
          <Button onClick={handleBuscar} disabled={isPending || !traceId.trim()}>
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Reconstruir flujo
          </Button>
        </div>
      </div>

      <EventosTabla filas={filas} isPending={isPending} mostrarTabla={true} />
    </div>
  )
}

// ── Tabla de eventos compartida ──────────────────────────────────────────────

function EventosTabla({
  filas, isPending, mostrarTabla,
}: {
  filas: AuditTrailRow[] | null
  isPending: boolean
  /** El flujo por trace cruza varias tablas → mostramos la columna "Tabla". */
  mostrarTabla: boolean
}) {
  if (isPending) {
    return (
      <div className="rounded-xl border border-border-default py-16 text-center">
        <Loader2 size={24} className="mx-auto mb-3 animate-spin text-text-tertiary" />
        <p className="text-sm text-text-tertiary">Consultando el audit_log…</p>
      </div>
    )
  }

  if (filas === null) return null

  if (filas.length === 0) {
    return (
      <div className="rounded-xl border border-border-default py-16 text-center">
        <History size={28} className="mx-auto mb-3 text-text-tertiary" />
        <p className="text-sm font-medium text-text-primary">Sin eventos registrados</p>
        <p className="text-xs text-text-tertiary mt-1">No hay trazas auditadas para esa búsqueda.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-default overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default bg-surface-elevated">
            <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Fecha</th>
            <th className="text-left px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Acción</th>
            {mostrarTabla && (
              <th className="text-left px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Tabla</th>
            )}
            <th className="text-left px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Actor</th>
            <th className="text-left px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Origen</th>
            <th className="text-left px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">trace_id</th>
            <th className="px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide text-center">Cambios</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {filas.map(f => <EventoFila key={f.id} fila={f} mostrarTabla={mostrarTabla} />)}
        </tbody>
      </table>
    </div>
  )
}

function EventoFila({ fila, mostrarTabla }: { fila: AuditTrailRow; mostrarTabla: boolean }) {
  const [open, setOpen] = useState(false)
  const tieneCambios = !!fila.datos_antes || !!fila.datos_nuevo
  // INSERT/UPDATE/DELETE u otros: badge neutro si no está mapeado.
  const badge = ACCION_BADGE[fila.accion] ?? 'bg-surface-elevated text-text-secondary'
  // +2 fija (fecha + acción) y el resto de columnas según `mostrarTabla`.
  const colSpan = mostrarTabla ? 7 : 6

  return (
    <>
      <tr className="hover:bg-surface-elevated transition-colors align-top">
        <td className="px-4 py-3 text-text-tertiary text-xs whitespace-nowrap">{formatFecha(fila.created_at)}</td>
        <td className="px-3 py-3">
          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>
            {fila.accion}
          </span>
        </td>
        {mostrarTabla && (
          <td className="px-3 py-3 text-text-secondary text-xs whitespace-nowrap">{fila.tabla_nombre}</td>
        )}
        <td className="px-3 py-3 text-text-secondary text-xs">{fila.actor_email ?? '—'}</td>
        <td className="px-3 py-3 text-text-tertiary text-xs">{fila.origen ?? '—'}</td>
        <td className="px-3 py-3 text-text-tertiary text-[11px] font-mono">
          {fila.trace_id ? (
            <span title={fila.trace_id}>{fila.trace_id.slice(0, 8)}…</span>
          ) : '—'}
        </td>
        <td className="px-3 py-3 text-center">
          {tieneCambios ? (
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
              aria-expanded={open}
            >
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {open ? 'Ocultar' : 'Ver diff'}
            </button>
          ) : (
            <span className="text-text-tertiary text-xs">—</span>
          )}
        </td>
      </tr>
      {open && tieneCambios && (
        <tr className="bg-surface-elevated/50">
          <td colSpan={colSpan} className="px-4 py-3">
            <DiffView antes={fila.datos_antes} nuevo={fila.datos_nuevo} />
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * Muestra el cambio antes→después campo por campo. Resalta solo los campos que
 * cambiaron (o que solo existen en uno de los dos lados).
 */
function DiffView({
  antes, nuevo,
}: {
  antes: Record<string, unknown> | null
  nuevo: Record<string, unknown> | null
}) {
  const keys = Array.from(new Set([
    ...Object.keys(antes ?? {}),
    ...Object.keys(nuevo ?? {}),
  ])).sort()

  if (keys.length === 0) {
    return <p className="text-xs text-text-tertiary">Sin datos de detalle.</p>
  }

  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-tertiary">
            <th className="text-left font-medium py-1 pr-3">Campo</th>
            <th className="text-left font-medium py-1 pr-3">Antes</th>
            <th className="text-left font-medium py-1">Después</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {keys.map(k => {
            const a = antes?.[k]
            const n = nuevo?.[k]
            const cambio = fmt(a) !== fmt(n)
            return (
              <tr key={k} className={cambio ? 'text-text-primary' : 'text-text-tertiary'}>
                <td className="py-1 pr-3 font-mono align-top">{k}</td>
                <td className={`py-1 pr-3 align-top break-all ${cambio ? 'text-red-600 dark:text-red-400' : ''}`}>{fmt(a)}</td>
                <td className={`py-1 align-top break-all ${cambio ? 'text-green-600 dark:text-green-400' : ''}`}>{fmt(n)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
