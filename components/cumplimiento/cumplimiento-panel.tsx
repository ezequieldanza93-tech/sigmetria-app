'use client'

import { useState, useTransition } from 'react'
import {
  ShieldCheck, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw,
  ListChecks, Gauge, ServerCog, History, FileWarning,
} from 'lucide-react'
import { refrescarAutocontrol } from '@/lib/actions/autocontrol'
import { useToast } from '@/lib/hooks/use-toast'
import type {
  Inconsistencia, EstadoCumplimientoEmpresa, UmbralAlerta, CronRunRow,
} from '@/lib/actions/autocontrol'

type Severidad = 'info' | 'warning' | 'critical'

const SEV_BADGE: Record<Severidad, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
}
const SEV_ICON: Record<Severidad, React.ComponentType<{ size?: number; className?: string }>> = {
  critical: AlertCircle, warning: AlertTriangle, info: CheckCircle2,
}

const REGLA_LABEL: Record<string, string> = {
  inspeccion_sin_reporte: 'Inspección sin reporte',
  documento_vencido_sin_renovacion: 'Documento vencido sin renovación',
  observacion_vencida_sin_seguimiento: 'Observación vencida sin seguimiento',
  gestion_no_ejecutada: 'Gestión no ejecutada',
  riesgo_critico_sin_resolver: 'Riesgo crítico sin resolver',
  incidente_sin_cerrar: 'Incidente sin cerrar',
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
}

interface Props {
  inconsistencias: Inconsistencia[]
  cumplimiento: EstadoCumplimientoEmpresa[]
  umbrales: UmbralAlerta[]
  cronRuns: CronRunRow[]
  isSuperAdmin: boolean
}

type Tab = 'resumen' | 'inconsistencias' | 'supervision'

export function CumplimientoPanel({
  inconsistencias, cumplimiento, umbrales, cronRuns, isSuperAdmin,
}: Props) {
  const [tab, setTab] = useState<Tab>('resumen')
  const [isPending, startTransition] = useTransition()
  const { success, error: toastError } = useToast()

  const totalCriticas = inconsistencias.filter(i => i.severidad === 'critical').length
  const totalVencidos = cumplimiento.reduce((s, e) => s + e.docs_vencidos, 0)

  function handleRefrescar() {
    startTransition(async () => {
      const r = await refrescarAutocontrol()
      if (r.success) {
        success(`Autocontrol actualizado: ${r.data.alertas} alertas regeneradas`)
        location.reload()
      } else {
        toastError(r.error)
      }
    })
  }

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'resumen', label: 'Estado por empresa', icon: Gauge },
    { id: 'inconsistencias', label: `Inconsistencias (${inconsistencias.length})`, icon: ListChecks },
    ...(isSuperAdmin ? [{ id: 'supervision' as Tab, label: 'Supervisión del cron', icon: ServerCog }] : []),
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-primary/10 p-2.5">
            <ShieldCheck size={22} className="text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Estado de cumplimiento y autocontrol</h1>
            <p className="text-sm text-text-tertiary mt-0.5">
              Validación automática y supervisión · Res. SRT 48/2025 Art. 4.9
            </p>
          </div>
        </div>
        <button
          onClick={handleRefrescar}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-text-primary border border-border-default px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Actualizando…' : 'Refrescar autocontrol'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={FileWarning} label="Documentos vencidos" value={totalVencidos} tone={totalVencidos > 0 ? 'danger' : 'ok'} />
        <KpiCard icon={AlertCircle} label="Inconsistencias críticas" value={totalCriticas} tone={totalCriticas > 0 ? 'danger' : 'ok'} />
        <KpiCard icon={ListChecks} label="Inconsistencias totales" value={inconsistencias.length} tone={inconsistencias.length > 0 ? 'warn' : 'ok'} />
        <KpiCard icon={Gauge} label="Empresas monitoreadas" value={cumplimiento.length} tone="neutral" />
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

      {tab === 'resumen' && <ResumenTab cumplimiento={cumplimiento} umbrales={umbrales} />}
      {tab === 'inconsistencias' && <InconsistenciasTab inconsistencias={inconsistencias} cumplimiento={cumplimiento} />}
      {tab === 'supervision' && isSuperAdmin && <SupervisionTab cronRuns={cronRuns} />}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string; value: number; tone: 'ok' | 'warn' | 'danger' | 'neutral'
}) {
  const toneClass = {
    ok: 'text-green-600', warn: 'text-yellow-600', danger: 'text-red-600', neutral: 'text-text-secondary',
  }[tone]
  return (
    <div className="rounded-xl border border-border-default p-4 bg-surface-default">
      <div className="flex items-center gap-2 text-text-tertiary text-xs">
        <Icon size={14} className={toneClass} />
        {label}
      </div>
      <p className={`mt-2 text-2xl font-semibold ${tone === 'neutral' ? 'text-text-primary' : toneClass}`}>{value}</p>
    </div>
  )
}

function ResumenTab({ cumplimiento, umbrales }: {
  cumplimiento: EstadoCumplimientoEmpresa[]; umbrales: UmbralAlerta[]
}) {
  return (
    <div className="space-y-5">
      {/* Umbrales de alerta temprana */}
      <div className="rounded-xl border border-border-default p-4">
        <h2 className="text-sm font-medium text-text-primary mb-2">Alertas tempranas configuradas</h2>
        <p className="text-xs text-text-tertiary mb-3">
          Avisos antes del vencimiento (in-app + email para críticas). Estos umbrales complementan las notificaciones in-app de 10/3/0 días.
        </p>
        <div className="flex flex-wrap gap-2">
          {umbrales.length === 0 && <span className="text-xs text-text-tertiary">Sin umbrales configurados.</span>}
          {umbrales.map(u => (
            <span key={u.id} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${SEV_BADGE[u.severidad]} ${u.activo ? '' : 'opacity-40 line-through'}`}>
              {u.dias_antes} días antes
            </span>
          ))}
        </div>
      </div>

      {/* Tabla por empresa */}
      <div className="rounded-xl border border-border-default overflow-hidden">
        {cumplimiento.length === 0 ? (
          <div className="py-16 text-center text-sm text-text-tertiary">Sin empresas para mostrar.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-elevated">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Empresa</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Vencidos</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Por vencer</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Alertas abiertas</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">ISO 45001</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {cumplimiento.map(e => (
                <tr key={e.empresa_id} className="hover:bg-surface-elevated transition-colors">
                  <td className="px-4 py-3 text-text-primary font-medium">{e.razon_social}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={e.docs_vencidos > 0 ? 'text-red-600 font-semibold' : 'text-text-tertiary'}>{e.docs_vencidos}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={e.docs_por_vencer > 0 ? 'text-yellow-600 font-semibold' : 'text-text-tertiary'}>{e.docs_por_vencer}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={e.alertas_criticas > 0 ? 'text-red-600 font-semibold' : e.alertas_abiertas > 0 ? 'text-yellow-600' : 'text-text-tertiary'}>
                      {e.alertas_abiertas}{e.alertas_criticas > 0 ? ` (${e.alertas_criticas} crít.)` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-text-secondary">{e.iso_cobertura_pct}%</span>
                      <span className="text-[10px] text-text-tertiary">({e.establecimientos_iso}/{e.establecimientos_total})</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function InconsistenciasTab({ inconsistencias, cumplimiento }: {
  inconsistencias: Inconsistencia[]; cumplimiento: EstadoCumplimientoEmpresa[]
}) {
  const empresaNombre = new Map(cumplimiento.map(e => [e.empresa_id, e.razon_social]))
  const ordenadas = [...inconsistencias].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 } as Record<string, number>
    return (order[a.severidad] ?? 3) - (order[b.severidad] ?? 3)
  })

  if (inconsistencias.length === 0) {
    return (
      <div className="rounded-xl border border-border-default py-16 text-center">
        <CheckCircle2 size={32} className="mx-auto mb-3 text-green-500" />
        <p className="text-sm font-medium text-text-primary">Sin inconsistencias detectadas</p>
        <p className="text-xs text-text-tertiary mt-1">El autocontrol no encontró desvíos abiertos.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-default overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default bg-surface-elevated">
            <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Severidad</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Regla</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Empresa</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {ordenadas.map((i, idx) => {
            const sev = i.severidad as Severidad
            const Icon = SEV_ICON[sev]
            return (
              <tr key={`${i.codigo}-${i.referencia_id}-${idx}`} className="hover:bg-surface-elevated transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${SEV_BADGE[sev]}`}>
                    <Icon size={11} />
                    {sev === 'critical' ? 'Crítica' : sev === 'warning' ? 'Advertencia' : 'Info'}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-primary font-medium whitespace-nowrap">{REGLA_LABEL[i.codigo] ?? i.codigo}</td>
                <td className="px-4 py-3 text-text-secondary">{empresaNombre.get(i.empresa_id) ?? '—'}</td>
                <td className="px-4 py-3 text-text-secondary"><p className="line-clamp-2">{i.mensaje}</p></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SupervisionTab({ cronRuns }: { cronRuns: CronRunRow[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <History size={15} />
        Últimas corridas de los procesos automáticos (bitácora de autocontrol).
      </div>
      <div className="rounded-xl border border-border-default overflow-hidden">
        {cronRuns.length === 0 ? (
          <div className="py-16 text-center text-sm text-text-tertiary">Sin corridas registradas todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-elevated">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Job</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Inicio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Estado</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Notif.</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Alertas</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Inconsist.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {cronRuns.map(r => (
                <tr key={r.id} className="hover:bg-surface-elevated transition-colors">
                  <td className="px-4 py-3 text-text-primary font-medium whitespace-nowrap">{r.job_name}</td>
                  <td className="px-4 py-3 text-text-tertiary text-xs whitespace-nowrap">{formatFecha(r.started_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                      r.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                      : r.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                    }`}>
                      {r.status === 'success' ? 'OK' : r.status === 'error' ? 'Error' : 'Corriendo'}
                    </span>
                    {r.error && <p className="text-[10px] text-red-500 mt-1 line-clamp-1">{r.error}</p>}
                  </td>
                  <td className="px-3 py-3 text-center text-text-secondary">{r.notificaciones_generadas ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-text-secondary">{r.alertas_generadas ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-text-secondary">{r.inconsistencias_detectadas ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
