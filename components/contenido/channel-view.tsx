'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { PreviewToggle } from '@/components/contenido/preview-toggle'
import { PublicacionCard } from '@/components/contenido/publicacion-card'
import {
  defaultPreviewView,
  type ContenidoCanal,
  type ContenidoPublicacionFull,
} from '@/lib/contenido/types'

interface ChannelViewProps {
  canal: ContenidoCanal
  publicaciones: ContenidoPublicacionFull[]
  getUrl: (pathOrUrl: string | null | undefined) => string | null
  perfilNombre: string
  onEdit: (pub: ContenidoPublicacionFull) => void
  onOpen: (pub: ContenidoPublicacionFull) => void
}

export function ChannelView({ canal, publicaciones, getUrl, perfilNombre, onEdit, onOpen }: ChannelViewProps) {
  const [view, setView] = useState(defaultPreviewView(canal.slug))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-tertiary">
          {publicaciones.length} {publicaciones.length === 1 ? 'publicación' : 'publicaciones'}
        </p>
        <PreviewToggle view={view} onChange={setView} />
      </div>

      {publicaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-default py-16 text-center">
          <ImageOff size={32} className="text-text-tertiary" />
          <div>
            <p className="text-sm font-medium text-text-primary">Todavía no hay publicaciones en {canal.nombre}</p>
            <p className="text-xs text-text-tertiary">Creá una con el botón “Nueva publicación”.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-8">
          {publicaciones.map((pub) => (
            <div key={pub.id} className="w-full max-w-sm">
              <PublicacionCard
                pub={pub}
                view={view}
                getUrl={getUrl}
                perfilNombre={perfilNombre}
                onEdit={onEdit}
                onOpen={onOpen}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
