'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { useActualizarStatusFeedback } from '@/lib/queries/feedback'
import type { Feedback, FeedbackStatus } from '@/lib/types'
import { toast } from '@/lib/hooks/use-toast'

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'revisado', label: 'Revisado' },
  { value: 'descartado', label: 'Descartado' },
  { value: 'implementado', label: 'Implementado' },
]

const TIPO_LABELS: Record<string, string> = {
  nps: 'NPS',
  bug: 'Bug',
  sugerencia: 'Sugerencia',
  general: 'General',
}

interface AdminFeedbackDetailModalProps {
  feedback: Feedback | null
  onClose: () => void
}

export function AdminFeedbackDetailModal({ feedback, onClose }: AdminFeedbackDetailModalProps) {
  const [status, setStatus] = useState<FeedbackStatus>(feedback?.status ?? 'nuevo')
  const mutation = useActualizarStatusFeedback()

  if (!feedback) return null

  const fb = feedback
  const isNps = fb.tipo === 'nps'

  async function handleSaveStatus() {
    const formData = new FormData()
    formData.set('id', fb.id)
    formData.set('status', status)

    try {
      await mutation.mutateAsync(formData)
      toast.success('Estado actualizado')
      onClose()
    } catch {
      toast.error('Error al actualizar el estado')
    }
  }

  return (
    <Modal open={!!feedback} onClose={onClose} title="Detalle de Feedback" size="default">
      <div className="space-y-4">
        {/* Tipo + Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info">{TIPO_LABELS[fb.tipo] ?? fb.tipo}</Badge>
          {isNps && fb.nps_categoria && (
            <Badge
              variant={
                fb.nps_categoria === 'promotor' ? 'success' :
                fb.nps_categoria === 'pasivo' ? 'warning' : 'danger'
              }
            >
              {fb.nps_categoria}
            </Badge>
          )}
        </div>

        {/* Usuario */}
        <div>
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Usuario</span>
          <p className="text-sm text-text-primary">
            {fb.user_nombre || fb.user_email || 'Usuario eliminado'}
          </p>
          {fb.user_email && fb.user_nombre && (
            <p className="text-xs text-text-tertiary">{fb.user_email}</p>
          )}
        </div>

        {/* Consultora */}
        <div>
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Consultora</span>
          <p className="text-sm text-text-primary">
            {fb.consultora_nombre || 'Sin consultora'}
          </p>
        </div>

        {/* NPS Score */}
        {isNps && fb.nps_score !== null && (
          <div>
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Puntaje NPS</span>
            <p className="text-2xl font-bold text-text-primary">{fb.nps_score}/10</p>
          </div>
        )}

        {/* Título (no-NPS) */}
        {!isNps && fb.titulo && (
          <div>
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Título</span>
            <p className="text-sm font-medium text-text-primary">{fb.titulo}</p>
          </div>
        )}

        {/* Comentario */}
        {fb.comentario && (
          <div>
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              {isNps ? 'Comentario' : 'Descripción'}
            </span>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{fb.comentario}</p>
          </div>
        )}

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Creado</span>
            <p className="text-sm text-text-primary">{formatDateTime(fb.created_at)}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Actualizado</span>
            <p className="text-sm text-text-primary">{formatDateTime(fb.updated_at)}</p>
          </div>
        </div>

        {/* Metadata */}
        {fb.metadata && Object.keys(fb.metadata).length > 0 && (
          <div>
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Metadata</span>
            <pre className="text-xs text-text-tertiary mt-1 bg-surface-sunken p-2 rounded-lg overflow-auto max-h-20">
              {JSON.stringify(fb.metadata, null, 2)}
            </pre>
          </div>
        )}

        {/* Status update (solo no-NPS) */}
        {!isNps && (
          <div className="border-t border-border-subtle pt-4">
            <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider block mb-2">
              Cambiar estado
            </label>
            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
                className="flex-1 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary bg-surface-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleSaveStatus}
                disabled={status === fb.status || mutation.isPending}
              >
                {mutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}

        {/* Close */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
