'use client'

import { Pencil, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PublicacionPreview } from '@/components/contenido/publicacion-preview'
import { buildPreviewMedia } from '@/lib/contenido/preview-media'
import { ESTADO_LABELS, ESTADO_COLORS, type ContenidoPublicacionFull, type PreviewView } from '@/lib/contenido/types'

interface PublicacionCardProps {
  pub: ContenidoPublicacionFull
  view: PreviewView
  getUrl: (pathOrUrl: string | null | undefined) => string | null
  perfilNombre: string
  onEdit: (pub: ContenidoPublicacionFull) => void
  onOpen: (pub: ContenidoPublicacionFull) => void
}

export function PublicacionCard({ pub, view, getUrl, perfilNombre, onEdit, onOpen }: PublicacionCardProps) {
  const media = buildPreviewMedia(pub.media, getUrl)

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onOpen(pub)}
        className="block w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        aria-label={`Abrir ${pub.titulo}`}
      >
        <PublicacionPreview pub={pub} media={media} view={view} perfilNombre={perfilNombre} />
      </button>

      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{pub.titulo}</p>
          <p className="truncate text-xs text-text-tertiary">{pub.formato.nombre}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ESTADO_COLORS[pub.estado.slug])}>
            {ESTADO_LABELS[pub.estado.slug]}
          </span>
          <button
            type="button"
            onClick={() => onEdit(pub)}
            aria-label="Editar"
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => onOpen(pub)}
            aria-label="Abrir"
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
