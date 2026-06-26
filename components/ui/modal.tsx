'use client'

import { useEffect, useId, useRef } from 'react'
import { MessageSquareWarning } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  size?: 'default' | 'full' | 'wide'
  /**
   * Si es `false`, el modal NO se cierra al hacer click en el backdrop
   * ni con la tecla ESC. Solo se cierra por los botones que llaman a `onClose`.
   * Default `true` (comportamiento actual intacto).
   */
  dismissable?: boolean
}

const SIZE_CLASSES = {
  default: 'md:max-w-lg',
  full: 'md:max-w-4xl',
  wide: 'md:max-w-6xl',
}

export function Modal({ open, onClose, title, children, className, size = 'default', dismissable = true }: ModalProps) {
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

  function handleReportar() {
    window.dispatchEvent(
      new CustomEvent('sig:open-reporte', { detail: { tipo: 'error' } })
    )
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={e => {
        // El evento `cancel` lo dispara ESC. Si el modal no es dismissable,
        // lo prevenimos para que ESC no cierre (solo se cierra por botón).
        if (!dismissable) e.preventDefault()
      }}
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
        if (dismissable && e.target === dialogRef.current) onClose()
      }}
    >
      <div className="md:p-6 max-md:flex max-md:flex-col max-md:h-full">
        <div className="flex items-center justify-between md:mb-5 max-md:shrink-0 max-md:p-4 max-md:border-b max-md:border-border-subtle">
          <h2 id={titleId} className="text-base sm:text-lg font-semibold text-text-primary truncate pr-2">{title}</h2>
          <div className="flex items-center gap-1 shrink-0">
            {/* Botón Reportar — dispara sig:open-reporte desde dentro del dialog,
                donde sí es clickeable. FloatingReportButtons escucha el evento
                y abre el modal de reporte (showModal sobre este dialog). */}
            <button
              type="button"
              onClick={handleReportar}
              aria-label="Reportar un problema con este formulario"
              title="Reportar un problema"
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
            >
              <MessageSquareWarning size={16} strokeWidth={1.75} />
            </button>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="text-text-tertiary hover:text-text-primary transition-colors text-xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
            >
              &times;
            </button>
          </div>
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
