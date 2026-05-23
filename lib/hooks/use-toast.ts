'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

type Listener = () => void

const listeners = new Set<Listener>()
let toasts: Toast[] = []

function emitChange() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return toasts
}

function addToast(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substring(2, 9)
  const newToast: Toast = { ...toast, id }
  toasts = [...toasts, newToast]
  emitChange()

  const duration = toast.duration ?? 4000
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return id
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  emitChange()
}

export function useToast() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    return addToast({ message, type, duration })
  }, [])

  const success = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'success', duration })
  }, [])

  const error = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'error', duration })
  }, [])

  const warning = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'warning', duration })
  }, [])

  const info = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'info', duration })
  }, [])

  const dismiss = useCallback((id: string) => {
    removeToast(id)
  }, [])

  return {
    toasts: currentToasts,
    toast,
    success,
    error,
    warning,
    info,
    dismiss,
  }
}

export const toast = {
  success: (message: string, duration?: number) => addToast({ message, type: 'success', duration }),
  error: (message: string, duration?: number) => addToast({ message, type: 'error', duration }),
  warning: (message: string, duration?: number) => addToast({ message, type: 'warning', duration }),
  info: (message: string, duration?: number) => addToast({ message, type: 'info', duration }),
}
