'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#fff' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h1 style={{ color: '#DC2626', fontSize: '1.25rem', fontWeight: 700 }}>Error crítico</h1>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Copiá el stack abajo y reportalo.
          </p>

          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '1rem', marginTop: '1rem' }}>
            <strong style={{ fontSize: '0.75rem', color: '#991B1B' }}>MENSAJE</strong>
            <pre style={{ fontSize: '0.8rem', color: '#7F1D1D', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {error.message}
            </pre>
          </div>

          {error.stack && (
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem', marginTop: '1rem' }}>
              <strong style={{ fontSize: '0.75rem', color: '#374151' }}>STACK TRACE</strong>
              <pre style={{ fontSize: '0.75rem', color: '#4B5563', marginTop: '0.5rem', overflow: 'auto', maxHeight: '300px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {error.stack}
              </pre>
            </div>
          )}

          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '1rem' }}>Digest: {error.digest}</p>
          )}

          <button
            onClick={reset}
            style={{ marginTop: '1rem', background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
