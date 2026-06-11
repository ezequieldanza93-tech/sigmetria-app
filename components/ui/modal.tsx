'use client'

import { useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  size?: 'default' | 'full' | 'wide'
}

const SIZE_CLASSES = {
  default: 'md:max-w-lg',
  full: 'md:max-w-4xl',
  wide: 'md:max-w-6xl',
}

export function Modal({ open, onClose, title, children, className, size = 'default' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className={cn(
        'bg-surface-base p-0 backdrop:bg-black/40',
        // Móvil (<md): full-screen, sin bordes ni márgenes.
        'max-md:fixed max-md:inset-0 max-md:m-0 max-md:h-auto max-md:max-h-none max-md:w-auto max-md:max-w-none max-md:rounded-none max-md:border-0',
        // Desktop (md+): ventana centrada — diseño actual intacto.
        'md:w-[calc(100vw-1rem)] md:rounded-2xl md:border md:border-border-subtle md:shadow-[var(--shadow-lg)]',
        SIZE_CLASSES[size],
        className,
      )}
      onClick={e => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="md:p-6 max-md:flex max-md:flex-col max-md:h-full">
        <div className="flex items-center justify-between md:mb-5 max-md:shrink-0 max-md:p-4 max-md:border-b max-md:border-border-subtle">
          <h2 id={titleId} className="text-base sm:text-lg font-semibold text-text-primary truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-text-tertiary hover:text-text-primary transition-colors text-xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
          >
            &times;
          </button>
        </div>
        {/* En desktop el wrapper es `contents` (no afecta el layout actual);
            en móvil se vuelve el área scrolleable del full-screen. */}
        <div className="contents max-md:block max-md:flex-1 max-md:min-h-0 max-md:overflow-y-auto max-md:overflow-x-hidden max-md:p-4">
          {children}
        </div>
      </div>
    </dialog>
  )
}
