'use client'

import { useEffect, useState } from 'react'

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

export function ErrorCapture() {
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<CapturedError[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setErrors(loadErrors())

    const refresh = () => setErrors(loadErrors())
    window.addEventListener('__sig_error_captured__', refresh)

    const onError = (ev: ErrorEvent) => {
      saveError({
        type: 'error',
        message: ev.message ?? String(ev.error?.message ?? 'Unknown'),
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
      saveError({
        type: 'unhandledrejection',
        message: reason?.message ?? String(reason ?? 'Unknown rejection'),
        stack: reason?.stack ?? undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('__sig_error_captured__', refresh)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  const allText = errors.map(e =>
    `── ${e.timestamp} ── ${e.type}\n` +
    `URL: ${e.url}\n` +
    `UA: ${e.userAgent}\n` +
    `MSG: ${e.message}\n` +
    (e.source ? `SRC: ${e.source}:${e.line}:${e.col}\n` : '') +
    (e.stack ? `STACK:\n${e.stack}\n` : '')
  ).join('\n\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(allText || 'No errors captured')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = allText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setErrors([])
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 99999,
          background: errors.length > 0 ? '#DC2626' : '#374151',
          color: '#fff',
          border: 'none',
          borderRadius: '999px',
          padding: '10px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          fontFamily: 'system-ui, sans-serif',
        }}
        title="Ver errores capturados"
      >
        {errors.length > 0 ? `⚠ ${errors.length} error${errors.length > 1 ? 'es' : ''}` : '✓ Sin errores'}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 70,
            left: 16,
            zIndex: 99999,
            width: 'min(640px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 100px)',
            background: '#0F172A',
            color: '#F1F5F9',
            border: '1px solid #334155',
            borderRadius: 12,
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 13 }}>Errores capturados ({errors.length})</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={copy}
                style={{
                  background: copied ? '#16A34A' : '#3B82F6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copiado' : 'Copiar todo'}
              </button>
              <button
                onClick={clear}
                style={{
                  background: 'transparent',
                  color: '#94A3B8',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Limpiar
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent',
                  color: '#94A3B8',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ overflow: 'auto', padding: 12, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
            {errors.length === 0 ? (
              <p style={{ color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No hay errores capturados aún.</p>
            ) : (
              errors.map((e, i) => (
                <div key={i} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #1E293B' }}>
                  <div style={{ color: '#F87171', fontWeight: 600, marginBottom: 4 }}>
                    [{e.type}] {e.timestamp}
                  </div>
                  <div style={{ color: '#CBD5E1', marginBottom: 4 }}>
                    <strong>URL:</strong> {e.url}
                  </div>
                  <div style={{ color: '#FCA5A5', marginBottom: 4, wordBreak: 'break-word' }}>
                    <strong>MSG:</strong> {e.message}
                  </div>
                  {e.source && (
                    <div style={{ color: '#CBD5E1', marginBottom: 4, wordBreak: 'break-all' }}>
                      <strong>SRC:</strong> {e.source}:{e.line}:{e.col}
                    </div>
                  )}
                  {e.stack && (
                    <pre style={{ color: '#94A3B8', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 6, fontSize: 10 }}>
                      {e.stack}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
