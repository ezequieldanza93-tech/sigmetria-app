'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, RefreshCw, CheckCheck, FileText, GraduationCap, Gauge, CalendarDays } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Notificacion } from '@/lib/types'
import { refrescarNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, getNotificaciones } from '@/lib/actions/notificacion'
import { Button } from '@/components/ui/button'

const ENTIDAD_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  gestion: FileText,
  documento_empresa: FileText,
  documento_establecimiento: FileText,
  documento_persona: FileText,
  matricula: GraduationCap,
  certificado: Gauge,
}

function getEntidadIcon(tipo: string) {
  const Icon = ENTIDAD_ICON[tipo] ?? Bell
  return Icon
}

function getEntidadLabel(tipo: string): string {
  const map: Record<string, string> = {
    gestion: 'Gestión',
    documento_empresa: 'Documento de Empresa',
    documento_establecimiento: 'Documento de Establecimiento',
    documento_persona: 'Documento de Persona',
    matricula: 'Matrícula',
    certificado: 'Certificado de Calibración',
  }
  return map[tipo] ?? tipo
}

function getVencimientoColor(dias: number): string {
  if (dias < 0) return 'bg-danger-bg border-red-200'
  if (dias <= 3) return 'bg-orange-50 border-orange-200'
  return 'bg-warning-bg border-yellow-200'
}

function getVencimientoBadge(dias: number): { label: string; cls: string } {
  if (dias < 0) return { label: `Vencido hace ${Math.abs(dias)}d`, cls: 'bg-danger-bg text-danger' }
  if (dias === 0) return { label: 'Vence hoy', cls: 'bg-orange-100 text-orange-700' }
  return { label: `Vence en ${dias}d`, cls: 'bg-warning-bg text-warning' }
}

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'todas' | 'no_leidas'>('todas')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getNotificaciones()
    setNotificaciones(data)
    setLoading(false)
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    const result = await refrescarNotificaciones()
    if (!result.success) {
      setError(result.error)
    }
    await load()
    setRefreshing(false)
  }, [load])

  const handleMarcarLeida = useCallback(async (id: string) => {
    await marcarNotificacionLeida(id)
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }, [])

  const handleMarcarTodas = useCallback(async () => {
    await marcarTodasLeidas()
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = notificaciones.filter(n => filter === 'no_leidas' ? !n.leida : true)
  const noLeidas = notificaciones.filter(n => !n.leida).length

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell size={24} className="text-brand-primary" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Notificaciones</h1>
            <p className="text-sm text-text-tertiary">
              {noLeidas > 0
                ? `${noLeidas} notificación${noLeidas !== 1 ? 'es' : ''} sin leer`
                : 'No hay notificaciones pendientes'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {noLeidas > 0 && (
            <Button variant="secondary" size="sm" onClick={handleMarcarTodas}>
              <CheckCheck size={14} className="mr-1" />
              Todas leídas
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilter('todas')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            filter === 'todas'
              ? 'bg-brand-muted text-brand-primary'
              : 'text-text-tertiary hover:text-text-secondary bg-surface-elevated'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter('no_leidas')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            filter === 'no_leidas'
              ? 'bg-brand-muted text-brand-primary'
              : 'text-text-tertiary hover:text-text-secondary bg-surface-elevated'
          }`}
        >
          No leídas {noLeidas > 0 && `(${noLeidas})`}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-surface-elevated rounded-xl h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={40} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">
            {filter === 'no_leidas' ? 'No tenés notificaciones sin leer' : 'No hay notificaciones'}
          </p>
          <p className="text-sm text-text-tertiary mt-1">Toca &quot;Refrescar&quot; para buscar novedades</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const Icon = getEntidadIcon(n.entidad_tipo)
            const badge = getVencimientoBadge(n.dias_restantes)
            return (
              <div
                key={n.id}
                className={`rounded-xl border p-4 transition-colors ${getVencimientoColor(n.dias_restantes)} ${
                  !n.leida ? 'ring-1 ring-brand-primary/20' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg shrink-0 ${
                    n.dias_restantes < 0 ? 'bg-danger-bg' : 'bg-white/60'
                  }`}>
                    <Icon size={18} className={n.dias_restantes < 0 ? 'text-danger' : 'text-text-secondary'} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                        {getEntidadLabel(n.entidad_tipo)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-text-primary truncate">{n.mensaje}</p>
                    {n.contexto_nombre && (
                      <p className="text-xs text-text-tertiary mt-0.5 truncate">{n.contexto_nombre}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        Vence: {formatDate(n.fecha_vencimiento)}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  {!n.leida && (
                    <button
                      onClick={() => handleMarcarLeida(n.id)}
                      className="shrink-0 p-1.5 rounded-lg text-text-tertiary hover:text-brand-primary hover:bg-brand-muted transition-colors"
                      title="Marcar como leída"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
