'use client'

import { useRef } from 'react'
import { Camera, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'

interface FotoInputProps {
  /** Mismo handler que ya usabas en el <input>: lee `e.target.files`. */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /**
   * `accept` del input de "Subir archivo". Default `'image/*'`.
   * Permite, por ejemplo, `'application/pdf,image/*'` donde se necesite PDF.
   * El input de "Sacar foto" SIEMPRE usa `image/*` + cámara (capture).
   */
  accept?: string
  /** Permite elegir varios archivos al subir. La cámara siempre es de a una. */
  multiple?: boolean
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
}

/** ¿`accept` admite imágenes? (para mostrar/ocultar el botón de cámara). */
function acceptsImages(accept: string): boolean {
  const a = accept.toLowerCase()
  return (
    a.includes('image/') ||
    a.includes('.jpg') ||
    a.includes('.jpeg') ||
    a.includes('.png') ||
    a.includes('.webp') ||
    a.includes('.gif') ||
    a.includes('.heic') ||
    a.includes('.heif') ||
    a === '*' ||
    a.includes('*/*')
  )
}

/**
 * Dos controles claros para cargar un archivo:
 *  - "Sacar foto" → `<input capture="environment" accept="image/*">` que ABRE LA CÁMARA en móvil.
 *  - "Subir archivo" → `<input>` SIN `capture` que abre galería / explorador de archivos,
 *    respetando el `accept` recibido (sirve para PDF u otros formatos).
 *
 * Son DOS inputs separados a propósito: en móvil, mezclar `capture` con un selector
 * común hace que el navegador NO abra la cámara de forma confiable. Separándolos,
 * "Sacar foto" siempre dispara la cámara y "Subir archivo" siempre el selector.
 *
 * Orden/prioridad según dispositivo:
 *  - Móvil: "Sacar foto" primaria, "Subir archivo" secundaria.
 *  - Desktop: "Subir archivo" primaria, "Sacar foto" secundaria (sigue disponible para webcam).
 *
 * Si `accept` no admite imágenes, el botón de cámara no se muestra (no aplica).
 */
export function FotoInput({
  onChange,
  accept = 'image/*',
  multiple = false,
  disabled = false,
  className,
  size = 'md',
}: FotoInputProps) {
  const isMobile = useIsMobile()
  const captureRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const showCamera = acceptsImages(accept)

  const base = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
    size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
  )
  const primaryCls = cn(base, 'bg-brand-primary text-white hover:bg-brand-hover')
  const secondaryCls = cn(base, 'bg-surface-elevated border border-border-default text-text-primary hover:bg-surface-sunken')
  const iconSize = size === 'sm' ? 14 : 16

  const sacar = (role: 'primary' | 'secondary') => (
    <button
      key="sacar"
      type="button"
      disabled={disabled}
      onClick={() => captureRef.current?.click()}
      className={role === 'primary' ? primaryCls : secondaryCls}
    >
      <Camera size={iconSize} aria-hidden="true" /> Sacar foto
    </button>
  )

  const subir = (role: 'primary' | 'secondary') => (
    <button
      key="subir"
      type="button"
      disabled={disabled}
      onClick={() => uploadRef.current?.click()}
      className={role === 'primary' ? primaryCls : secondaryCls}
    >
      <Upload size={iconSize} aria-hidden="true" /> Subir archivo
    </button>
  )

  function renderButtons() {
    if (!showCamera) return [subir('primary')]
    return isMobile
      ? [sacar('primary'), subir('secondary')]
      : [subir('primary'), sacar('secondary')]
  }

  return (
    <div className={cn('flex flex-col sm:flex-row flex-wrap gap-2', className)}>
      {renderButtons()}
      {/* Cámara: SIEMPRE imagen + capture. Es el control que abre la cámara en móvil. */}
      {showCamera && (
        <input
          ref={captureRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onChange}
          disabled={disabled}
          className="hidden"
        />
      )}
      {/* Subir: respeta `accept` (puede incluir PDF). Sin capture → abre el selector. */}
      <input
        ref={uploadRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={disabled}
        className="hidden"
      />
    </div>
  )
}
