'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  size?: 'default' | 'full'
}

const SIZE_CLASSES = {
  default: 'max-w-lg',
  full: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, className, size = 'default' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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
      className={cn(
        'rounded-2xl border border-border-subtle bg-surface-base shadow-[var(--shadow-lg)] p-0 backdrop:bg-black/40 w-full',
        SIZE_CLASSES[size],
        className,
      )}
      onClick={e => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
