'use client'

import { Badge } from '@/components/ui/badge'
import { SkeletonTable } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'
import type { Feedback, FeedbackStatus, FeedbackNpsTipo, NpsCategoria } from '@/lib/types'

const STATUS_BADGE: Record<FeedbackStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  nuevo: { label: 'Nuevo', variant: 'info' },
  revisado: { label: 'Revisado', variant: 'warning' },
  descartado: { label: 'Descartado', variant: 'danger' },
  implementado: { label: 'Implementado', variant: 'success' },
}

function NpsCategoriaBadge({ categoria }: { categoria: NpsCategoria | null }) {
  if (!categoria) return null
  const colors: Record<NpsCategoria, string> = {
    promotor: 'bg-success-bg text-success dark:bg-green-900/30 dark:text-green-400',
    pasivo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    detractor: 'bg-danger-bg text-danger dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[categoria]}`}>
      {categoria}
    </span>
  )
}

interface AdminFeedbackTableProps {
  feedbacks: Feedback[] | undefined
  isLoading: boolean
  tipo: FeedbackNpsTipo
  onSelect: (item: Feedback) => void
}

export function AdminFeedbackTable({ feedbacks, isLoading, tipo, onSelect }: AdminFeedbackTableProps) {
  if (isLoading) {
    return <SkeletonTable rows={5} columns={tipo === 'nps' ? 5 : 5} />
  }

  if (!feedbacks?.length) {
    return (
      <EmptyState
        variant="generic"
        title="Sin resultados"
        description={tipo === 'nps' ? 'No hay respuestas NPS todavía.' : `No hay tickets de este tipo.`}
      />
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border-subtle">
        <table className="w-full">
          <thead className="bg-surface-sunken">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Consultora</th>
              {tipo === 'nps' && (
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Score</th>
              )}
              {tipo !== 'nps' && (
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Título</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Comentario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {feedbacks.map((item) => (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                className="hover:bg-surface-sunken cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                  {formatDateTime(item.created_at)}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  {item.user_nombre || item.user_email || 'Usuario eliminado'}
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {item.consultora_nombre || '—'}
                </td>
                {tipo === 'nps' && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">{item.nps_score}</span>
                      <NpsCategoriaBadge categoria={item.nps_categoria} />
                    </div>
                  </td>
                )}
                {tipo !== 'nps' && (
                  <td className="px-4 py-3 text-sm font-medium text-text-primary max-w-[200px] truncate">
                    {item.titulo}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-text-secondary max-w-[250px] truncate">
                  {item.comentario || '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_BADGE[item.status].variant}>
                    {STATUS_BADGE[item.status].label}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile accordion */}
      <div className="md:hidden space-y-2">
        {feedbacks.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full text-left bg-surface-base border border-border-subtle rounded-lg p-4 hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-tertiary">{formatDateTime(item.created_at)}</span>
              <Badge variant={STATUS_BADGE[item.status].variant}>
                {STATUS_BADGE[item.status].label}
              </Badge>
            </div>
            {tipo === 'nps' && item.nps_score !== null && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-text-primary">{item.nps_score}/10</span>
                <NpsCategoriaBadge categoria={item.nps_categoria} />
              </div>
            )}
            {tipo !== 'nps' && (
              <p className="text-sm font-medium text-text-primary truncate">{item.titulo}</p>
            )}
            <p className="text-xs text-text-secondary mt-1">
              {item.user_nombre || item.user_email || 'Usuario eliminado'}
              {item.consultora_nombre ? ` · ${item.consultora_nombre}` : ''}
            </p>
          </button>
        ))}
      </div>
    </>
  )
}
