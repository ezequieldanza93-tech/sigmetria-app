'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { AlertCircle, AlertTriangle, Info, CheckCircle2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolverAlerta } from '@/lib/actions/alerta'
import { useToast } from '@/lib/hooks/use-toast'

// ── Tipos ──────────────────────────────────────────────────────────────────

type Severidad = 'info' | 'warning' | 'critical'
type FiltroSeveridad = 'todas' | Severidad
type FiltroEstado = 'no_resueltas' | 'resueltas' | 'todas'

interface Alerta {
  id: string
  tipo: string
  severidad: Severidad
  mensaje: string
  resuelta: boolean
  resuelta_at: string | null
  created_at: string
  empresas: { id: string; nombre: string } | null
  establecimientos: { nombre: string } | null
}

interface Empresa {
  id: string
  nombre: string
}

// ── Constantes ─────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  documento_por_vencer: 'Documento por vencer',
  documento_vencido: 'Documento vencido',
  siniestro_sin_investigar: 'Incidente sin investigar',
  siniestro_sin_cerrar: 'Incidente sin cerrar',
  capacitacion_no_realizada: 'Capacitación no realizada',
  riesgo_critico_activo: 'Riesgo crítico activo',
}

const SEV_CONFIG: Record<Severidad, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge: string }> = {
  critical: { label: 'Crítica', icon: AlertCircle, badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
  warning:  { label: 'Advertencia', icon: AlertTriangle, badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' },
  info:     { label: 'Info', icon: Info, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
}

const SEV_TABS: { value: FiltroSeveridad; label: string }[] = [
  { value: 'todas',    label: 'Todas' },
  { value: 'critical', label: 'Críticas' },
  { value: 'warning',  label: 'Advertencias' },
  { value: 'info',     label: 'Info' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
}

// ── Componente principal ───────────────────────────────────────────────────

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroSev, setFiltroSev] = useState<FiltroSeveridad>('todas')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('no_resueltas')
  const [resolviendo, setResolviendo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { success, error: toastError } = useToast()
  void isPending

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('alertas')
      .select('id, tipo, severidad, mensaje, resuelta, resuelta_at, created_at, empresas(id, nombre:razon_social), establecimientos(nombre)')
      .order('resuelta', { ascending: true })
      .order('created_at', { ascending: false })
    setAlertas((data ?? []) as unknown as Alerta[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // También cargar lista de empresas para el filtro
    async function loadEmpresas() {
      const supabase = createClient()
      const { data } = await supabase.from('empresas').select('id, nombre:razon_social').eq('is_active', true).order('razon_social')
      setEmpresas((data ?? []) as unknown as Empresa[])
    }
    loadEmpresas()
  }, [load])

  // Filtrado client-side
  const filtradas = alertas
    .filter(a => {
      if (filtroEmpresa !== 'todas') {
        const empId = (a.empresas as { id: string } | null)?.id
        if (empId !== filtroEmpresa) return false
      }
      if (filtroSev !== 'todas' && a.severidad !== filtroSev) return false
      if (filtroEstado === 'no_resueltas' && a.resuelta) return false
      if (filtroEstado === 'resueltas' && !a.resuelta) return false
      return true
    })
    // Ordenar por severidad (critical > warning > info), luego fecha desc
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 } as Record<string, number>
      const diff = (order[a.severidad] ?? 3) - (order[b.severidad] ?? 3)
      if (diff !== 0) return diff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  async function handleResolver(id: string) {
    setResolviendo(id)
    startTransition(async () => {
      try {
        await resolverAlerta(id)
        success('Alerta marcada como resuelta')
        await load()
      } catch (e) {
        toastError(e instanceof Error ? e.message : 'No se pudo resolver la alerta')
      } finally {
        setResolviendo(null)
      }
    })
  }

  const pendienteCount = alertas.filter(a => !a.resuelta).length
  const criticalCount = alertas.filter(a => !a.resuelta && a.severidad === 'critical').length

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Alertas SRT</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Validación automática · Res. SRT 48/2025 Art. 4.9
          </p>
        </div>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg dark:bg-red-950 dark:text-red-400">
              <AlertCircle size={14} />
              {criticalCount} crítica{criticalCount !== 1 ? 's' : ''}
            </span>
          )}
          {pendienteCount > 0 && criticalCount === 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-lg dark:bg-yellow-950 dark:text-yellow-400">
              <AlertTriangle size={14} />
              {pendienteCount} pendiente{pendienteCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-text-primary border border-border-default px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Empresa */}
        <select
          value={filtroEmpresa}
          onChange={e => setFiltroEmpresa(e.target.value)}
          className="text-sm border border-border-default rounded-lg px-3 py-1.5 bg-surface-default text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="todas">Todas las empresas</option>
          {empresas.map(e => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>

        {/* Severidad tabs */}
        <div className="flex items-center rounded-lg border border-border-default overflow-hidden">
          {SEV_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFiltroSev(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filtroSev === tab.value
                  ? 'bg-brand-primary text-white'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Estado */}
        <div className="flex items-center rounded-lg border border-border-default overflow-hidden">
          {([
            { value: 'no_resueltas', label: 'Sin resolver' },
            { value: 'resueltas', label: 'Resueltas' },
            { value: 'todas', label: 'Todas' },
          ] as { value: FiltroEstado; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFiltroEstado(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filtroEstado === opt.value
                  ? 'bg-brand-primary text-white'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border-default overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-text-tertiary">Cargando alertas...</div>
        ) : filtradas.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-3 text-green-500" />
            <p className="text-sm font-medium text-text-primary">Sin alertas en esta vista</p>
            <p className="text-xs text-text-tertiary mt-1">
              {filtroEstado === 'no_resueltas' ? 'No hay alertas pendientes.' : 'Ajustá los filtros para ver más resultados.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-elevated">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Severidad</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Empresa / Establecimiento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Mensaje</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtradas.map(a => {
                const sev = SEV_CONFIG[a.severidad]
                const SevIcon = sev.icon
                const empresa = (a.empresas as { nombre: string } | null)?.nombre
                const estab = (a.establecimientos as { nombre: string } | null)?.nombre

                return (
                  <tr
                    key={a.id}
                    className={`hover:bg-surface-elevated transition-colors ${a.resuelta ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${sev.badge}`}>
                        <SevIcon size={11} />
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-primary font-medium whitespace-nowrap">
                      {TIPO_LABELS[a.tipo] ?? a.tipo}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {empresa && <p className="font-medium text-text-primary">{empresa}</p>}
                      {estab && <p className="text-xs text-text-tertiary">{estab}</p>}
                      {!empresa && !estab && <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary max-w-xs">
                      <p className="line-clamp-2">{a.mensaje}</p>
                    </td>
                    <td className="px-4 py-3 text-text-tertiary whitespace-nowrap text-xs">
                      {formatFecha(a.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!a.resuelta && (
                        <button
                          onClick={() => handleResolver(a.id)}
                          disabled={resolviendo === a.id}
                          className="inline-flex items-center gap-1 text-xs font-medium text-text-tertiary hover:text-green-600 border border-border-default hover:border-green-400 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 size={12} />
                          {resolviendo === a.id ? 'Resolviendo…' : 'Marcar resuelta'}
                        </button>
                      )}
                      {a.resuelta && (
                        <span className="text-xs text-text-tertiary">Resuelta</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtradas.length > 0 && (
        <p className="text-xs text-text-tertiary">
          Mostrando {filtradas.length} de {alertas.length} alertas totales
        </p>
      )}
    </div>
  )
}
