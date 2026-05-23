'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Bell, CheckCheck, FileText, GraduationCap, Gauge, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Notificacion } from '@/lib/types'
import { marcarNotificacionLeida, marcarTodasLeidas, getNotificaciones } from '@/lib/actions/notificacion'
import { formatDate } from '@/lib/utils'

const ENTIDAD_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  gestion: FileText,
  documento_empresa: FileText,
  documento_establecimiento: FileText,
  documento_persona: FileText,
  matricula: GraduationCap,
  certificado: Gauge,
}

function getEntidadIcon(tipo: string) {
  return ENTIDAD_ICON[tipo] ?? Bell
}

function getVencimientoBadge(dias: number): { label: string; cls: string } {
  if (dias < 0) return { label: `Venc`, cls: 'bg-red-100 text-red-700' }
  if (dias === 0) return { label: 'Hoy', cls: 'bg-orange-100 text-orange-700' }
  if (dias <= 3) return { label: `${dias}d`, cls: 'bg-orange-100 text-orange-700' }
  return { label: `${dias}d`, cls: 'bg-yellow-100 text-yellow-700' }
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [notifCount, setNotifCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const data = await getNotificaciones()
    setNotificaciones(data.slice(0, 10))
    setNotifCount(data.filter(n => !n.leida).length)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // Fallback polling every 60s
    pollRef.current = setInterval(load, 60000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('notificaciones-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
        },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleMarcarLeida = async (id: string) => {
    await marcarNotificacionLeida(id)
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setNotifCount(prev => Math.max(0, prev - 1))
  }

  const handleMarcarTodas = async () => {
    await marcarTodasLeidas()
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
    setNotifCount(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        aria-label="Notificaciones"
        title="Notificaciones"
      >
        <Bell size={18} strokeWidth={1.75} />
        {notifCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {notifCount > 9 ? '9+' : notifCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface-elevated border border-border-subtle rounded-xl shadow-[var(--shadow-lg)] z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div>
              <p className="text-sm font-semibold text-text-primary">Notificaciones</p>
              <p className="text-xs text-text-tertiary">
                {notifCount > 0
                  ? `${notifCount} sin leer`
                  : 'Todo al día'}
              </p>
            </div>
            {notifCount > 0 && (
              <button
                onClick={handleMarcarTodas}
                className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium transition-colors"
              >
                Todas leídas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-surface-sunken rounded-lg h-16" />
                ))}
              </div>
            ) : notificaciones.length === 0 ? (
              <div className="text-center py-8">
                <Bell size={24} className="mx-auto text-text-tertiary mb-2" />
                <p className="text-sm text-text-secondary">No hay notificaciones</p>
              </div>
            ) : (
              <div>
                {notificaciones.map(n => {
                  const Icon = getEntidadIcon(n.entidad_tipo)
                  const badge = getVencimientoBadge(n.dias_restantes)
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors border-b border-border-subtle last:border-b-0 ${
                        !n.leida ? 'bg-brand-primary/5' : ''
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        n.dias_restantes < 0 ? 'bg-red-100' : 'bg-surface-base'
                      }`}>
                        <Icon size={14} className={n.dias_restantes < 0 ? 'text-red-600' : 'text-text-tertiary'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                          {!n.leida && (
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-text-primary line-clamp-2">{n.mensaje}</p>
                        {n.contexto_nombre && (
                          <p className="text-[11px] text-text-tertiary mt-0.5 truncate">{n.contexto_nombre}</p>
                        )}
                        <p className="text-[11px] text-text-tertiary mt-0.5">{formatDate(n.fecha_vencimiento)}</p>
                      </div>
                      {!n.leida && (
                        <button
                          onClick={() => handleMarcarLeida(n.id)}
                          className="shrink-0 p-1 rounded text-text-tertiary hover:text-brand-primary hover:bg-brand-muted transition-colors"
                          title="Marcar como leída"
                        >
                          <CheckCheck size={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <Link
            href="/dashboard/notificaciones"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-brand-primary hover:text-brand-primary/80 font-medium border-t border-border-subtle transition-colors rounded-b-xl"
          >
            <ExternalLink size={14} />
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}
