'use client'

import { useState } from 'react'
import { CalendarClock, RefreshCw, Info } from 'lucide-react'
import {
  useConfiguracionVencimientos,
  useUpdateConfiguracionVencimiento,
  usePaises,
  useUpdatePaisDocumento,
} from '@/lib/queries/notificacion'
import { banderaClase } from '@/lib/paises'
import type { ConfiguracionVencimiento, TipoEntidadVencimiento } from '@/lib/types'

const TIPO_ENTIDAD_LABELS: Record<TipoEntidadVencimiento, string> = {
  empresa: 'Empresa',
  establecimiento: 'Establecimiento',
  persona: 'Persona',
  gestion: 'Gestión',
}

const TIPO_ENTIDAD_ORDER: TipoEntidadVencimiento[] = ['empresa', 'establecimiento', 'persona', 'gestion']

function ToggleSwitch({
  checked,
  onChange,
  loading,
}: {
  checked: boolean
  onChange: () => void
  loading?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-brand-primary' : 'bg-border-strong'
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-surface-base shadow-sm ring-0 transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function VencimientosConfigPage() {
  const { data: configs, isLoading, refetch } = useConfiguracionVencimientos()
  const { data: paises } = usePaises()
  const updateMutation = useUpdateConfiguracionVencimiento()
  const updatePaisMutation = useUpdatePaisDocumento()
  const [localDias, setLocalDias] = useState<Record<string, string>>({})

  // Países ordenados: Argentina (AR) primero, resto alfabético (ya viene ordenado por nombre).
  const paisesOrdenados = [
    ...(paises ?? []).filter(p => p.codigo === 'AR'),
    ...(paises ?? []).filter(p => p.codigo !== 'AR'),
  ]

  const handleToggleVencimiento = (item: ConfiguracionVencimiento) => {
    updateMutation.mutate({ id: item.id, updates: { tiene_vencimiento: !item.tiene_vencimiento } })
  }

  const handleToggleActivo = (item: ConfiguracionVencimiento) => {
    updateMutation.mutate({ id: item.id, updates: { activo: !item.activo } })
  }

  const handleDiasAviso = (item: ConfiguracionVencimiento, value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || num > 365) return
    setLocalDias(prev => ({ ...prev, [item.id]: value }))
    updateMutation.mutate({ id: item.id, updates: { dias_aviso: num } })
  }

  const handleTipoEntidad = (item: ConfiguracionVencimiento, tipo: TipoEntidadVencimiento) => {
    updateMutation.mutate({ id: item.id, updates: { tipo_entidad: tipo } })
  }

  const handlePais = (item: ConfiguracionVencimiento, paisCodigo: string) => {
    if (!item.documento_tipo_id) return
    updatePaisMutation.mutate({ documentoTipoId: item.documento_tipo_id, paisCodigo })
  }

  const grouped = TIPO_ENTIDAD_ORDER.map(tipo => ({
    tipo,
    label: TIPO_ENTIDAD_LABELS[tipo],
    items: (configs ?? []).filter(c => c.tipo_entidad === tipo),
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarClock size={24} className="text-brand-primary" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Vencimientos y Notificaciones</h1>
            <p className="text-sm text-text-tertiary">
              Configurá qué documentos y gestiones tienen vencimiento y con cuánta anticipación notificar
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-surface-elevated rounded-lg transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Recargar
        </button>
      </div>

      {/* Info alert */}
      <div className="flex items-start gap-2 bg-brand-muted/50 border border-brand-muted rounded-lg px-4 py-3 mb-6 text-sm text-text-secondary">
        <Info size={16} className="shrink-0 mt-0.5 text-brand-primary" />
        <p>
          Activá el vencimiento para los tipos de documento o gestión que quieras monitorear.
          El sistema notificará automáticamente según los días de aviso configurados.
          Las notificaciones se generan una vez por día vía cron automático.
        </p>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3, 4].map(g => (
            <div key={g}>
              <div className="animate-pulse h-6 w-32 bg-surface-elevated rounded mb-3" />
              <div className="space-y-2">
                {[1, 2, 3].map(r => (
                  <div key={r} className="animate-pulse h-12 bg-surface-elevated rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => {
            if (group.items.length === 0) return null
            return (
              <div key={group.tipo}>
                <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
                  {group.label}
                </h2>
                <div className="border border-border-subtle rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-sunken text-xs font-medium text-text-tertiary uppercase tracking-wider">
                        <th className="text-left px-4 py-2.5">Nombre</th>
                        <th className="text-center px-3 py-2.5 w-36">Sección</th>
                        <th className="text-center px-3 py-2.5 w-44">País</th>
                        <th className="text-center px-3 py-2.5 w-28">Notificación</th>
                        <th className="text-center px-3 py-2.5 w-24">Días aviso</th>
                        <th className="text-center px-3 py-2.5 w-20">Activo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(item => (
                        <tr
                          key={item.id}
                          className="border-t border-border-subtle hover:bg-surface-sunken/50 transition-colors"
                        >
                          <td className="px-4 py-2.5">
                            <span className={`text-sm ${!item.activo ? 'text-text-tertiary' : 'text-text-primary'}`}>
                              {item.nombre}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <select
                              value={item.tipo_entidad}
                              onChange={e => handleTipoEntidad(item, e.target.value as TipoEntidadVencimiento)}
                              disabled={updateMutation.isPending}
                              className="text-xs bg-surface-base border border-border-subtle rounded-md px-2 py-1 text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {TIPO_ENTIDAD_ORDER.map(tipo => (
                                <option key={tipo} value={tipo}>{TIPO_ENTIDAD_LABELS[tipo]}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {item.documento_tipo_id ? (
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Bandera SVG (flag-icons) del país seleccionado — se ve a color en todos los SO */}
                                <span className={`${banderaClase(item.pais_id ?? 'AR')} rounded-sm shrink-0`} style={{ width: 18, height: 13 }} aria-hidden="true" />
                                <select
                                  value={item.pais_id ?? 'AR'}
                                  onChange={e => handlePais(item, e.target.value)}
                                  disabled={updatePaisMutation.isPending}
                                  className="text-xs bg-surface-base border border-border-subtle rounded-md px-2 py-1 text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {paisesOrdenados.map(p => (
                                    <option key={p.codigo} value={p.codigo}>
                                      {p.nombre}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span className="text-xs text-text-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={item.tiene_vencimiento}
                                onChange={() => handleToggleVencimiento(item)}
                                disabled={updateMutation.isPending}
                                className="w-4 h-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary focus:ring-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 accent-brand-primary"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              max={365}
                              value={localDias[item.id] ?? item.dias_aviso}
                              onChange={e => {
                                setLocalDias(prev => ({ ...prev, [item.id]: e.target.value }))
                              }}
                              onBlur={e => handleDiasAviso(item, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                              }}
                              disabled={!item.tiene_vencimiento}
                              className="w-16 text-center text-sm bg-surface-base border border-border-subtle rounded-md px-2 py-1 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex justify-center">
                              <ToggleSwitch
                                checked={item.activo}
                                onChange={() => handleToggleActivo(item)}
                                loading={updateMutation.isPending}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
