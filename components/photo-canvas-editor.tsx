'use client'

import dynamic from 'next/dynamic'
import type { MutableRefObject } from 'react'
import type { DrawObject } from './photo-canvas-editor-inner'

export type { DrawObject } from './photo-canvas-editor-inner'

export interface ObservacionCategoria {
  id: string
  nombre: string
  nivel: number
  color: string
}

export interface PhotoCanvasEditorProps {
  imageUrl: string
  onImageChange?: (blob: Blob) => void
  enableObservacionTool?: boolean
  categorias?: ObservacionCategoria[]
  onObservacionAdded?: (descripcion: string, categoriaId: string) => void
  initialObjects?: DrawObject[]
  onObjectsChange?: (objects: DrawObject[]) => void
  exportControl?: MutableRefObject<(() => Promise<Blob | null>) | null>
}

// Un único dynamic import garantiza que react-konva (Stage + hijos) viajen
// juntos en el mismo chunk y estén listos antes de montar el árbol.
const PhotoCanvasEditorInner = dynamic(
  () => import('./photo-canvas-editor-inner'),
  {
    ssr: false,
    loading: () => (
      <div className="border border-border-default rounded-lg bg-surface-base p-8 text-center text-sm text-text-tertiary">
        Cargando editor…
      </div>
    ),
  },
)

export function PhotoCanvasEditor(props: PhotoCanvasEditorProps) {
  return <PhotoCanvasEditorInner {...props} />
}
