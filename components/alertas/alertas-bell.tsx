'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { BellRing, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TIPO_LABELS: Record<string, string> = {
  documento_por_vencer: 'Documento por vencer',
  documento_vencido: 'Documento vencido',
  siniestro_sin_investigar: 'Siniestro sin investigar',
  siniestro_sin_cerrar: 'Siniestro sin cerrar',
  capacitacion_no_realizada: 'Capacitación no realizada',
  riesgo_critico_activo: 'Riesgo crítico activo',
}

interface AlertaItem {
  id: string
  tipo: string
  severidad: 'info' | 'warning' | 'critical'
  mensaje: string
  created_at: string
  empresas: { nombre: string } | null
}

const POLL_INTERVAL = 5 * 60 * 1000

export function AlertasBell() {
  const [open, setOpen] = useState(false)
  const [alertas, setAlertas] = useState<AlertaItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, count } = await supabase
        .from('alertas')
        .select('id, tipo, severidad, mensaje, created_at, empresas(nombre)', { count: 'exact' })
        .eq('resuelta', false)
        .limit(5)

      const sorted = ((data ?? []) as unknown as AlertaItem[]).sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 } as Record<string, number>
        const diff = (order[a.severidad] ?? 3) - (order[b.severidad] ?? 3)
        if (diff !== 0) return diff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setAlertas(sorted)
      setTotalCount(count ?? 0)
    } catch {
      // Network failures during polling are non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [load])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasCritical = alertas.some(a => a.severidad === 'critical')

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        aria-label={`${totalCount} alertas sin resolver`}
        title="Alertas SRT"
      >
        <BellRing size={18} strokeWidth={1.75} />
        {totalCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none ${
              hasCritical ? 'bg-red-600' : 'bg-yellow-500'
            }`}
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border-default bg-surface-default shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <span className="text-sm font-semibold text-text-primary">Alertas SRT</span>
            {totalCount > 0 && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  hasCritical
                    ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                    : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                }`}
              >
                {totalCount} sin resolver
              </span>
            )}
          </div>

          <div className="divide-y divide-border-subtle max-h-72 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">Cargando...</div>
            )}
            {!loading && alertas.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                <CheckCircle2 size={20} className="mx-auto mb-2 text-green-500" />
                Sin alertas activas
              </div>
            )}
            {alertas.map(a => (
              <div key={a.id} className="px-4 py-3 hover:bg-surface-elevated transition-colors">
                <div className="flex items-start gap-2">
                  {a.severidad === 'critical' ? (
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
                  ) : (
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-yellow-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary">
                      {TIPO_LABELS[a.tipo] ?? a.tipo}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{a.mensaje}</p>
                    {(a.empresas as { nombre: string } | null)?.nombre && (
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {(a.empresas as { nombre: string }).nombre}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-2.5 border-t border-border-subtle">
            <Link
              href="/dashboard/alertas"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Ver todas las alertas →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
