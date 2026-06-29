'use client'

import { useState } from 'react'
import { ExternalLink, Video, FileText, Clock, CheckCheck, Users } from 'lucide-react'
import { verificarBonus } from '@/lib/actions/fundadores'

interface BonusPendiente {
  id: string
  tipo: 'video' | 'nota'
  estado: 'pending' | 'verificado' | 'rechazado'
  mesesOtorgados: number | null
  url: string | null
  createdAt: string
  verificadoAt: string | null
  subscriptionId: string
  consultoraNombre: string | null
  adminEmail: string | null
  adminNombre: string | null
}

interface AdminFundadoresClientProps {
  bonuses: BonusPendiente[]
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function BonusRow({
  bonus,
  onActualizado,
}: {
  bonus: BonusPendiente
  onActualizado: (id: string, nuevoEstado: 'verificado' | 'rechazado') => void
}) {
  const [loading, setLoading] = useState<'aprobar' | 'rechazar' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleVerificar(accion: 'aprobar' | 'rechazar') {
    setLoading(accion)
    setError(null)
    try {
      const result = await verificarBonus({
        bonusId: bonus.id,
        accion,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        onActualizado(bonus.id, accion === 'aprobar' ? 'verificado' : 'rechazado')
      }
    } catch {
      setError('Error al procesar. Intentá de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const tipoLabel = bonus.tipo === 'video' ? 'Video' : 'Nota'
  const TipoIcon = bonus.tipo === 'video' ? Video : FileText

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-4 space-y-3">
      {/* Header de la tarjeta */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TipoIcon size={15} className="text-text-tertiary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {tipoLabel} — {bonus.consultoraNombre ?? 'Sin nombre'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Users size={11} className="text-text-tertiary" />
              <p className="text-xs text-text-tertiary">
                {bonus.adminNombre ?? bonus.adminEmail ?? 'Sin datos de contacto'}
                {bonus.adminNombre && bonus.adminEmail && (
                  <span className="text-text-placeholder"> · {bonus.adminEmail}</span>
                )}
              </p>
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning-bg text-warning flex-shrink-0">
          <Clock size={11} />
          Pendiente
        </span>
      </div>

      {/* URL de la reseña */}
      {bonus.url ? (
        <div className="flex items-center gap-2">
          <a
            href={bonus.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:underline break-all"
          >
            <ExternalLink size={12} />
            <span className="line-clamp-1">{bonus.url}</span>
          </a>
        </div>
      ) : (
        <p className="text-xs text-text-placeholder italic">Sin URL adjunta</p>
      )}

      {/* Fecha */}
      <p className="text-xs text-text-tertiary">
        Solicitado el {formatFecha(bonus.createdAt)}
      </p>

      {/* Acciones */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => handleVerificar('aprobar')}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-success-bg text-success rounded-lg border border-success/20 hover:bg-success/10 transition-colors disabled:opacity-50"
        >
          <CheckCheck size={13} />
          {loading === 'aprobar' ? 'Aprobando...' : 'Aprobar'}
        </button>
        <button
          onClick={() => handleVerificar('rechazar')}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-danger-bg text-danger rounded-lg border border-danger/20 hover:bg-danger/10 transition-colors disabled:opacity-50"
        >
          {loading === 'rechazar' ? 'Rechazando...' : 'Rechazar'}
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function AdminFundadoresClient({ bonuses: initialBonuses }: AdminFundadoresClientProps) {
  const [bonuses, setBonuses] = useState(initialBonuses)

  function handleActualizado(id: string, nuevoEstado: 'verificado' | 'rechazado') {
    // Sacar el bonus de la lista pendiente
    setBonuses(prev => prev.filter(b => b.id !== id))
  }

  if (bonuses.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-raised p-12 text-center">
        <CheckCheck size={32} className="mx-auto mb-3 text-success opacity-60" />
        <p className="text-sm font-medium text-text-primary">Todo verificado</p>
        <p className="text-xs text-text-tertiary mt-1">
          No hay solicitudes de bonus pendientes por ahora.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {bonuses.map(b => (
        <BonusRow
          key={b.id}
          bonus={b}
          onActualizado={handleActualizado}
        />
      ))}
    </div>
  )
}
