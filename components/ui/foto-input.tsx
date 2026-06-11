'use client'

import { useRef } from 'react'
import { Camera, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'

interface FotoInputProps {
  /** Mismo handler que ya usabas en el <input>: lee `e.target.files`. */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** `accept` del input de galería. El de cámara siempre usa `image/*`. */
  accept?: string
  /** Permite elegir varias fotos de la galería. La cámara siempre es de a una. */
  multiple?: boolean
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Dos botones para cargar una foto: "Sacar foto" (cámara) y "Elegir foto" (galería).
 *
 * Usa DOS inputs separados:
 *  - cámara → `capture="environment"` (abre la cámara trasera en móvil)
 *  - galería → sin `capture` (abre galería / explorador de archivos)
 *
 * Orden/prioridad según dispositivo:
 *  - Móvil: "Sacar foto" primaria, "Elegir foto" secundaria.
 *  - Desktop: "Elegir foto" primaria, "Sacar foto" secundaria (sigue disponible para webcam).
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
  const galleryRef = useRef<HTMLInputElement>(null)

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

  const elegir = (role: 'primary' | 'secondary') => (
    <button
      key="elegir"
      type="button"
      disabled={disabled}
      onClick={() => galleryRef.current?.click()}
      className={role === 'primary' ? primaryCls : secondaryCls}
    >
      <ImageIcon size={iconSize} aria-hidden="true" /> Elegir foto
    </button>
  )

  return (
    <div className={cn('flex flex-col sm:flex-row flex-wrap gap-2', className)}>
      {isMobile
        ? [sacar('primary'), elegir('secondary')]
        : [elegir('primary'), sacar('secondary')]}
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        disabled={disabled}
        className="hidden"
      />
      <input
        ref={galleryRef}
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
