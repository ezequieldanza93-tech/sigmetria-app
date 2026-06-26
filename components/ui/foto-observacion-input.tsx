'use client'

import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { FotoInput } from '@/components/ui/foto-input'
import { Modal } from '@/components/ui/modal'
import { PhotoCanvasEditor } from '@/components/photo-canvas-editor'
import { cn } from '@/lib/utils'

interface FotoObservacionInputProps {
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  className?: string
}

/**
 * Campo de UNA foto por observación con edición integrada (recortar/anotar/marcar).
 *
 * - Sin foto → muestra `<FotoInput />` (Sacar foto / Subir archivo).
 * - Con foto → thumbnail + "Editar" (abre el editor en un Modal full) y "Eliminar".
 *
 * El editor exporta el blob de forma IMPERATIVA vía `exportControl` (ref a una
 * función que hace flush + devuelve el PNG/JPEG), no vía el `onImageChange`
 * debounced: así el botón "Listo" obtiene SIEMPRE el último estado sin esperar
 * el debounce de 500ms. El blob se reempaqueta en un File conservando el nombre
 * original cuando existe.
 *
 * `enableObservacionTool` queda DESACTIVADO a propósito: estos formularios ya
 * tienen su propio campo de descripción aparte; acá solo se quieren las
 * herramientas de dibujo/marcado.
 */
export function FotoObservacionInput({
  value,
  onChange,
  disabled = false,
  className,
}: FotoObservacionInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const exportControl = useRef<(() => Promise<Blob | null>) | null>(null)

  // ObjectURL del File actual, con cleanup al cambiar/desmontar (evita leaks).
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onChange(file)
    // Permite volver a elegir el mismo archivo más tarde.
    e.target.value = ''
  }

  async function handleListo() {
    const blob = await exportControl.current?.()
    if (blob) {
      const nuevoFile = new File([blob], value?.name || 'observacion.png', {
        type: blob.type || 'image/png',
      })
      onChange(nuevoFile)
    }
    setEditing(false)
  }

  if (!value || !previewUrl) {
    return <FotoInput onChange={handlePick} disabled={disabled} size="sm" className={className} />
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="Foto observación"
        className="w-16 h-16 object-cover rounded-lg border border-border-subtle"
      />
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sig-600 hover:text-sig-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Pencil size={13} /> Editar
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={13} /> Eliminar
        </button>
      </div>

      {editing && (
        <Modal open title="Editar foto" onClose={() => setEditing(false)} size="full">
          <div className="space-y-4">
            <PhotoCanvasEditor imageUrl={previewUrl} exportControl={exportControl} />
            <div className="flex justify-end gap-2 sticky bottom-0 bg-surface-base pt-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3.5 py-2 text-sm rounded-lg border border-border-default text-text-secondary hover:bg-surface-base"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleListo}
                className="px-3.5 py-2 text-sm rounded-lg bg-sig-500 text-white hover:bg-sig-600"
              >
                Listo
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
