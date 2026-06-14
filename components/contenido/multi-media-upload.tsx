'use client'

import { useRef, useState } from 'react'
import { ImagePlus, X, GripVertical, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TipoMediaSlug } from '@/lib/contenido/types'

/** Slot de media en el form: existente (ya en DB) o nuevo (File local). */
export type MediaFormSlot =
  | { kind: 'existing'; id: string; url: string | null; tipoMedia: TipoMediaSlug }
  | { kind: 'new'; localId: string; file: File; previewUrl: string; tipoMedia: TipoMediaSlug }

interface MultiMediaUploadProps {
  slots: MediaFormSlot[]
  onChange: (slots: MediaFormSlot[]) => void
}

function tipoFromFile(file: File): TipoMediaSlug {
  return file.type.startsWith('video/') ? 'video' : 'imagen'
}

function slotKey(slot: MediaFormSlot): string {
  return slot.kind === 'existing' ? `e:${slot.id}` : `n:${slot.localId}`
}

/**
 * Carga multi-archivo (imagen/video) con orden arrastrable. Soporta carruseles:
 * el orden visual ES el orden final que se persiste. Controlado por el form padre.
 */
export function MultiMediaUpload({ slots, onChange }: MultiMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function handleAdd(files: FileList | null) {
    if (!files || files.length === 0) return
    const nuevos: MediaFormSlot[] = Array.from(files).map((file) => ({
      kind: 'new',
      localId:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      tipoMedia: tipoFromFile(file),
    }))
    onChange([...slots, ...nuevos])
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleRemove(index: number) {
    const slot = slots[index]
    if (slot.kind === 'new') URL.revokeObjectURL(slot.previewUrl)
    onChange(slots.filter((_, i) => i !== index))
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const next = slots.slice()
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    onChange(next)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text-secondary">
        Media {slots.length > 1 && <span className="text-text-tertiary">· arrastrá para ordenar</span>}
      </span>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {slots.map((slot, index) => {
          const preview = slot.kind === 'existing' ? slot.url : slot.previewUrl
          const esVideo = slot.tipoMedia === 'video'
          return (
            <div
              key={slotKey(slot)}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault()
                setOverIndex(index)
              }}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-lg border bg-surface-sunken cursor-grab active:cursor-grabbing',
                overIndex === index && dragIndex !== null ? 'border-brand-primary ring-2 ring-brand-primary' : 'border-border-default',
              )}
            >
              {esVideo ? (
                preview ? (
                  <video src={preview} className="h-full w-full object-cover" muted />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                    <Film size={20} />
                  </div>
                )
              ) : preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                  <ImagePlus size={20} />
                </div>
              )}

              {/* Número de orden */}
              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-semibold text-white">
                {index + 1}
              </span>

              {esVideo && (
                <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
                  <Film size={10} /> Video
                </span>
              )}

              <span className="absolute right-1 top-1 rounded bg-black/40 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical size={12} />
              </span>

              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label="Quitar archivo"
                className="absolute bottom-1 right-1 rounded-full bg-[var(--danger)] p-1 text-white opacity-0 transition-opacity hover:opacity-90 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          )
        })}

        {/* Botón agregar */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-default text-text-tertiary transition-colors hover:border-brand-primary hover:text-brand-primary"
        >
          <ImagePlus size={22} />
          <span className="text-[11px] font-medium">Agregar</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleAdd(e.target.files)}
      />
    </div>
  )
}
