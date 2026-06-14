'use client'

import { useEffect } from 'react'

interface CapturedError {
  type: string
  message: string
  source?: string
  line?: number
  col?: number
  stack?: string
  url: string
  userAgent: string
  timestamp: string
}

const STORAGE_KEY = '__sig_errors__'
const MAX_ERRORS = 50

function loadErrors(): CapturedError[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveError(err: CapturedError) {
  if (typeof window === 'undefined') return
  try {
    const all = loadErrors()
    all.unshift(err)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, MAX_ERRORS)))
    window.dispatchEvent(new Event('__sig_error_captured__'))
  } catch {}
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
