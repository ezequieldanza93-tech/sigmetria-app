'use client'

import type { CursoLeccion } from '@/lib/types'
import { Download } from 'lucide-react'

interface LeccionRendererProps {
  leccion: CursoLeccion
}

export function LeccionRenderer({ leccion }: LeccionRendererProps) {
  switch (leccion.tipo) {
    case 'video':
      return (
        <div className="space-y-4">
          <div className="aspect-video bg-black rounded-xl overflow-hidden">
            {leccion.contenido_url ? (
              <video
                src={leccion.contenido_url}
                controls
                className="w-full h-full"
                controlsList="nodownload"
              >
                Tu navegador no soporta el elemento de video.
              </video>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                No hay URL de video configurada
              </div>
            )}
          </div>
        </div>
      )

    case 'pdf':
      return (
        <div className="space-y-4">
          {leccion.contenido_url ? (
            <>
              <iframe
                src={leccion.contenido_url}
                className="w-full h-[600px] rounded-xl border border-border-subtle"
                title={leccion.titulo}
              />
              {leccion.descargable && (
                <a
                  href={leccion.contenido_url}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                >
                  <Download size={16} />
                  Descargar PDF
                </a>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-text-tertiary bg-surface-sunken rounded-xl">
              No hay PDF cargado
            </div>
          )}
        </div>
      )

    case 'texto':
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {leccion.contenido_texto ? (
            <div dangerouslySetInnerHTML={{ __html: leccion.contenido_texto }} />
          ) : (
            <p className="text-text-tertiary">Sin contenido de texto</p>
          )}
        </div>
      )

    case 'embed':
      return (
        <div className="space-y-4">
          {leccion.contenido_url ? (
            <div className="aspect-video rounded-xl overflow-hidden border border-border-subtle">
              <iframe
                src={leccion.contenido_url}
                className="w-full h-full"
                sandbox="allow-scripts allow-same-origin allow-forms"
                title={leccion.titulo}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-text-tertiary bg-surface-sunken rounded-xl">
              No hay embed configurado
            </div>
          )}
        </div>
      )

    default:
      return <p className="text-text-tertiary">Tipo de lección no soportado</p>
  }
}
