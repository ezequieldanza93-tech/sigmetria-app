'use client'

import { useState } from 'react'
import { Star, Gift, Clock, CheckCheck, Video, FileText } from 'lucide-react'
import { solicitarBonus } from '@/lib/actions/fundadores'

interface Bonus {
  id: string
  tipo: 'video' | 'nota'
  estado: 'pending' | 'verificado' | 'rechazado'
  mesesOtorgados: number | null
  url: string | null
  createdAt: string
  verificadoAt: string | null
}

interface FundadoresClientProps {
  subId: string
  founderDiscountPct: number
  currentPeriodEnd: string | null
  planNombre: string | null
  bonuses: Bonus[]
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function EstadoBadge({ estado }: { estado: Bonus['estado'] }) {
  if (estado === 'verificado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success">
        <CheckCheck size={11} />
        Verificado
      </span>
    )
  }
  if (estado === 'rechazado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger-bg text-danger">
        Rechazado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning-bg text-warning">
      <Clock size={11} />
      Pendiente de verificación
    </span>
  )
}

function SolicitarBonusForm({
  subId,
  tipo,
  onSuccess,
}: {
  subId: string
  tipo: 'video' | 'nota'
  onSuccess: () => void
}) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) {
      setError('La URL es requerida')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await solicitarBonus({ subId, tipo, url: url.trim() })
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    } catch {
      setError('Error al enviar la solicitud. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const labelTipo = tipo === 'video' ? 'reseña en video' : 'reseña escrita'
  const placeholder =
    tipo === 'video'
      ? 'https://youtube.com/watch?v=... o enlace de Loom'
      : 'https://... (enlace a tu nota o publicación)'

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <p className="text-xs text-text-tertiary">
        Compartí el enlace a tu {labelTipo}:
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 text-sm font-medium bg-brand-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Solicitar'}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  )
}

export function FundadoresClient({
  subId,
  founderDiscountPct,
  currentPeriodEnd,
  planNombre,
  bonuses: initialBonuses,
}: FundadoresClientProps) {
  const [bonuses, setBonuses] = useState(initialBonuses)
  const [showFormVideo, setShowFormVideo] = useState(false)
  const [showFormNota, setShowFormNota] = useState(false)

  const hasPendingVideo = bonuses.some(
    b => b.tipo === 'video' && b.estado === 'pending'
  )
  const hasPendingNota = bonuses.some(
    b => b.tipo === 'nota' && b.estado === 'pending'
  )

  function handleSuccess(tipo: 'video' | 'nota') {
    // Refrescar el estado local — en producción se hace reload o revalidación
    window.location.reload()
    if (tipo === 'video') setShowFormVideo(false)
    else setShowFormNota(false)
  }

  const mesesBonus = bonuses
    .filter(b => b.estado === 'verificado' && b.mesesOtorgados)
    .reduce((acc, b) => acc + (b.mesesOtorgados ?? 0), 0)

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star size={20} className="text-warning fill-warning" />
            <h1 className="text-2xl font-bold text-text-primary">Programa Fundadores</h1>
          </div>
          <p className="text-sm text-text-tertiary">
            Beneficios exclusivos por ser parte de la primera generación de Sigmetría HyS
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-warning-bg text-warning border border-warning/20">
          <Star size={13} className="fill-warning" />
          Fundador/a
        </span>
      </div>

      {/* Beneficios activos */}
      <div className="rounded-xl border border-border-default bg-surface-raised p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Beneficios activos</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-sunken p-3">
            <p className="text-xs text-text-tertiary mb-0.5">Descuento permanente</p>
            <p className="text-2xl font-bold text-success">{founderDiscountPct}%</p>
            <p className="text-xs text-text-tertiary">de por vida en {planNombre ?? 'tu plan'}</p>
          </div>
          <div className="rounded-lg bg-surface-sunken p-3">
            <p className="text-xs text-text-tertiary mb-0.5">Meses gratis por reseñas</p>
            <p className="text-2xl font-bold text-brand-primary">{mesesBonus}</p>
            <p className="text-xs text-text-tertiary">meses acumulados</p>
          </div>
        </div>
        {currentPeriodEnd && (
          <p className="text-xs text-text-tertiary">
            Período actual vence el {formatFecha(currentPeriodEnd)}
          </p>
        )}
      </div>

      {/* Bonuses por reseñas */}
      <div className="rounded-xl border border-border-default bg-surface-raised p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-brand-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Bonuses por reseñas</h2>
        </div>
        <p className="text-xs text-text-tertiary">
          Cada reseña verificada (video o nota escrita) te otorga meses adicionales gratis.
        </p>

        {/* Reseña en video */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Video size={14} className="text-text-secondary" />
              <span className="text-sm font-medium text-text-primary">Reseña en video</span>
            </div>
            {!hasPendingVideo && !showFormVideo && (
              <button
                onClick={() => setShowFormVideo(true)}
                className="text-xs px-2.5 py-1 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
              >
                Solicitar bonus
              </button>
            )}
            {hasPendingVideo && (
              <span className="text-xs text-warning flex items-center gap-1">
                <Clock size={11} />
                Pendiente
              </span>
            )}
          </div>
          {showFormVideo && !hasPendingVideo && (
            <SolicitarBonusForm
              subId={subId}
              tipo="video"
              onSuccess={() => handleSuccess('video')}
            />
          )}
        </div>

        {/* Reseña escrita */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileText size={14} className="text-text-secondary" />
              <span className="text-sm font-medium text-text-primary">Reseña escrita / nota</span>
            </div>
            {!hasPendingNota && !showFormNota && (
              <button
                onClick={() => setShowFormNota(true)}
                className="text-xs px-2.5 py-1 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
              >
                Solicitar bonus
              </button>
            )}
            {hasPendingNota && (
              <span className="text-xs text-warning flex items-center gap-1">
                <Clock size={11} />
                Pendiente
              </span>
            )}
          </div>
          {showFormNota && !hasPendingNota && (
            <SolicitarBonusForm
              subId={subId}
              tipo="nota"
              onSuccess={() => handleSuccess('nota')}
            />
          )}
        </div>
      </div>

      {/* Historial de bonuses */}
      {bonuses.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Historial de solicitudes</h2>
          <ul className="space-y-2">
            {bonuses.map(b => (
              <li
                key={b.id}
                className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
              >
                <div className="flex items-center gap-2">
                  {b.tipo === 'video' ? (
                    <Video size={13} className="text-text-tertiary" />
                  ) : (
                    <FileText size={13} className="text-text-tertiary" />
                  )}
                  <div>
                    <p className="text-sm text-text-primary capitalize">{b.tipo}</p>
                    <p className="text-xs text-text-tertiary">{formatFecha(b.createdAt)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <EstadoBadge estado={b.estado} />
                  {b.estado === 'verificado' && b.mesesOtorgados && (
                    <span className="text-xs text-success">+{b.mesesOtorgados} mes{b.mesesOtorgados > 1 ? 'es' : ''}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
