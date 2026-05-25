'use client'

import { useMisFeedbacks } from '@/lib/queries/feedback'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonTable } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import type { FeedbackNpsTipo, FeedbackStatus, NpsCategoria } from '@/lib/types'

const TIPO_LABELS: Record<FeedbackNpsTipo, string> = {
  nps: 'NPS',
  bug: 'Bug',
  sugerencia: 'Sugerencia',
  general: 'General',
}

const TIPO_ICONS: Record<FeedbackNpsTipo, string> = {
  nps: '⭐',
  bug: '🐛',
  sugerencia: '💡',
  general: '💬',
}

const STATUS_BADGE: Record<FeedbackStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  nuevo: { label: 'Nuevo', variant: 'info' },
  revisado: { label: 'Revisado', variant: 'warning' },
  descartado: { label: 'Descartado', variant: 'danger' },
  implementado: { label: 'Implementado', variant: 'success' },
}

function NpsCategoriaBadge({ categoria }: { categoria: NpsCategoria | null }) {
  if (!categoria) return null
  const colors: Record<NpsCategoria, string> = {
    promotor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pasivo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    detractor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[categoria]}`}>
      {categoria}
    </span>
  )
}

export function MisFeedbacksList() {
  const { data: feedbacks, isLoading } = useMisFeedbacks()

  if (isLoading) {
    return <SkeletonTable rows={3} columns={4} />
  }

  if (!feedbacks?.length) {
    return (
      <EmptyState
        variant="generic"
        title="Todavía no enviaste ningún feedback"
        description="Usá los formularios de arriba para calificar Sigmetría o enviarnos un mensaje."
      />
    )
  }

  return (
    <div className="space-y-2">
      {feedbacks.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 p-4 bg-surface-base border border-border-subtle rounded-lg hover:bg-surface-elevated transition-colors"
        >
          <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">
            {TIPO_ICONS[item.tipo]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {TIPO_LABELS[item.tipo]}
              </span>
              {item.tipo === 'nps' && item.nps_score !== null && (
                <>
                  <span className="text-sm font-bold text-text-primary">{item.nps_score}/10</span>
                  <NpsCategoriaBadge categoria={item.nps_categoria} />
                </>
              )}
              <Badge variant={STATUS_BADGE[item.status].variant}>
                {STATUS_BADGE[item.status].label}
              </Badge>
            </div>

            {item.tipo !== 'nps' && item.titulo && (
              <p className="text-sm font-medium text-text-primary mt-1 truncate">
                {item.titulo}
              </p>
            )}

            {item.comentario && (
              <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">
                {item.comentario}
              </p>
            )}

            <p className="text-xs text-text-tertiary mt-1">
              {formatDateTime(item.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
