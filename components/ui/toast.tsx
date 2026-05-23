'use client'

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { Toast as ToastType } from '@/lib/hooks/use-toast'

interface ToastProps {
  toast: ToastType
  onDismiss: (id: string) => void
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles = {
  success: {
    container: 'bg-success-bg border-success',
    icon: 'text-success',
    text: 'text-success',
  },
  error: {
    container: 'bg-danger-bg border-danger',
    icon: 'text-danger',
    text: 'text-danger',
  },
  warning: {
    container: 'bg-warning-bg border-warning',
    icon: 'text-warning',
    text: 'text-text-primary',
  },
  info: {
    container: 'bg-info-bg border-info',
    icon: 'text-info',
    text: 'text-text-primary',
  },
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = icons[toast.type]
  const style = styles[toast.type]

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-md
        animate-in slide-in-from-right-full fade-in duration-300
        ${style.container}
      `}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${style.icon}`} aria-hidden="true" />
      <p className={`text-sm font-medium flex-1 ${style.text}`}>{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={`
          flex-shrink-0 p-1 rounded-md transition-colors
          hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1
          ${style.icon}
        `}
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
