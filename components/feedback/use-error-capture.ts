'use client'

import { useEffect } from 'react'

export interface CapturedError {
  type: string
  message: string
  source?: string
  line?: number
  col?: number
  stack?: string
  url?: string
  userAgent?: string
  timestamp: string
}

export const ERROR_STORAGE_KEY = '__sig_errors__'
const MAX_ERRORS = 50
// Ventana de retención: un error capturado caduca a las 48 h. Evita que un
// error viejo viaje indefinidamente en cada reporte de feedback (acumulación
// infinita): si nadie lo reportó en ese plazo, deja de ser relevante.
const MAX_AGE_MS = 48 * 60 * 60 * 1000

function isFresh(err: CapturedError, now: number): boolean {
  const ts = Date.parse(err.timestamp)
  // Si el timestamp es inválido lo conservamos — preferimos no descartar por
  // un parseo fallido; el cap de MAX_ERRORS lo termina rotando igual.
  if (Number.isNaN(ts)) return true
  return now - ts <= MAX_AGE_MS
}

/**
 * Lee los errores capturados de localStorage, descartando los que superan la
 * ventana de retención (MAX_AGE_MS). Centraliza el acceso al storage para que
 * tanto el hook como el modal de reporte usen la misma lógica de expiración.
 */
export function loadErrors(): CapturedError[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ERROR_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    const now = Date.now()
    return (parsed as CapturedError[]).filter((e) => isFresh(e, now))
  } catch {
    return []
  }
}

function persist(errors: CapturedError[]) {
  try {
    localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(errors.slice(0, MAX_ERRORS)))
  } catch {
    // localStorage puede fallar en modo privado u origin bloqueado — lo ignoramos
  }
}

function saveError(err: CapturedError) {
  if (typeof window === 'undefined') return
  // loadErrors() ya purga los expirados, así que cada escritura limpia el storage.
  const all = loadErrors()
  all.unshift(err)
  persist(all)
  window.dispatchEvent(new Event('__sig_error_captured__'))
}

/**
 * Quita del storage los errores cuyo timestamp esté incluido en `timestamps`.
 * Se invoca tras enviar un reporte de problema con éxito para que esos errores
 * NO se reenvíen en el próximo reporte (corta la re-cuenta del mismo error).
 * También aprovecha para purgar los expirados (vía loadErrors).
 */
export function clearReportedErrors(timestamps: string[]) {
  if (typeof window === 'undefined') return
  if (timestamps.length === 0) return
  const enviados = new Set(timestamps)
  const restantes = loadErrors().filter((e) => !enviados.has(e.timestamp))
  persist(restantes)
  window.dispatchEvent(new Event('__sig_error_captured__'))
}

/**
 * Hook headless — solo registra listeners globales de errores JS y los persiste
 * en localStorage['__sig_errors__']. No renderiza nada.
 */
export function useErrorCapture() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      const message = ev.message ?? String(ev.error?.message ?? 'Unknown')

      // Hydration errors (React #418-425) casi siempre son extensiones del browser
      // que mutan el DOM antes de que React hidrate. Se recupera solo — no accionable.
      if (/Minified React error #(418|419|420|421|422|423|425)/.test(message)) return

      // Extensiones de crypto wallets (MetaMask, Phantom, Coinbase, etc.)
      if (/^\[EVM\]|MetaMask|ethereum\.|web3\.|phantom\.|coinbase/i.test(message)) return

      // Scripts de extensiones del browser
      if (ev.filename && /^(chrome|moz|safari-web|edge)-extension:\/\//.test(ev.filename)) return

      saveError({
        type: 'error',
        message,
        source: ev.filename,
        line: ev.lineno,
        col: ev.colno,
        stack: ev.error?.stack ?? undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      })
    }

    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason
      const message = reason?.message ?? String(reason ?? 'Unknown rejection')

      // Bundle desactualizado tras deploy: reload silencioso una vez por sesión
      if (message.includes('Server Action') && message.includes('was not found on the server')) {
        if (!sessionStorage.getItem('__sig_stale_bundle_reloaded__')) {
          sessionStorage.setItem('__sig_stale_bundle_reloaded__', '1')
          window.location.reload()
        }
        return
      }

      // Fallas de actualización del ServiceWorker — no accionable
      if (message.includes('ServiceWorker') || message.includes('serviceWorker')) return

      // Errores de red de polling/realtime — ya capturados en código de usuario
      if (
        reason instanceof TypeError &&
        (message === 'Failed to fetch' ||
          message === 'Load failed' ||
          message === 'NetworkError when attempting to fetch resource.')
      ) {
        return
      }

      saveError({
        type: 'unhandledrejection',
        message,
        stack: reason?.stack ?? undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}
