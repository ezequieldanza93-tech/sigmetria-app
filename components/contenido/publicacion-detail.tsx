'use client'

import { useState } from 'react'
import { Pencil, CalendarClock } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { PublicacionPreview } from '@/components/contenido/publicacion-preview'
import { PreviewToggle } from '@/components/contenido/preview-toggle'
import { DownloadButton } from '@/components/contenido/download-button'
import { buildPreviewMedia } from '@/lib/contenido/preview-media'
import {
  defaultPreviewView,
  ESTADO_LABELS,
  ESTADO_COLORS,
  CANAL_LABELS,
  type ContenidoPublicacionFull,
} from '@/lib/contenido/types'
import { cn } from '@/lib/utils'

interface PublicacionDetailProps {
  pub: ContenidoPublicacionFull | null
  getUrl: (pathOrUrl: string | null | undefined) => string | null
  perfilNombre: string
  onClose: () => void
  onEdit: (pub: ContenidoPublicacionFull) => void
}

function formatFecha(iso: string | null): string {
  if (!iso) return 'Sin fecha programada'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Sin fecha programada'
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PublicacionDetail({ pub, getUrl, perfilNombre, onClose, onEdit }: PublicacionDetailProps) {
  const [view, setView] = useState(pub ? defaultPreviewView(pub.canal.slug) : 'mobile')

  if (!pub) return null
  const media = buildPreviewMedia(pub.media, getUrl)

  return (
    <Modal open={!!pub} onClose={onClose} title={pub.titulo} size="wide">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Preview */}
        <div className="flex flex-col items-center gap-3">
          <PreviewToggle view={view} onChange={setView} />
          <div className="flex w-full justify-center overflow-y-auto py-2">
            <PublicacionPreview pub={pub} media={media} view={view} perfilNombre={perfilNombre} />
          </div>
        </div>

        {/* Datos + acciones */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              {CANAL_LABELS[pub.canal.slug]}
            </span>
            <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              {pub.formato.nombre}
            </span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', ESTADO_COLORS[pub.estado.slug])}>
              {ESTADO_LABELS[pub.estado.slug]}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <CalendarClock size={16} className="text-text-tertiary" />
            {formatFecha(pub.fecha_programada)}
          </div>

          {pub.descripcion && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">Descripción</p>
              <p className="whitespace-pre-wrap text-sm text-text-primary">{pub.descripcion}</p>
            </div>
          )}

          {pub.hashtags.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {pub.hashtags.map((h) => (
                  <span key={h.id} className="rounded-full bg-brand-muted px-2 py-0.5 text-xs font-medium text-brand-primary">
                    #{h.texto}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-border-subtle pt-4">
            <DownloadButton pub={pub} getUrl={getUrl} />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                onEdit(pub)
                onClose()
              }}
            >
              <Pencil size={16} /> Editar publicación
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
