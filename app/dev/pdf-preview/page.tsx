'use client'

/**
 * /dev/pdf-preview — Visor de desarrollo del report-kit
 *
 * Genera el documento de demostración del kit y lo muestra en un <iframe>,
 * para validar VISUALMENTE el molde (header, footer, watermark, márgenes,
 * tipografía, PhotoBox, cierre) sin ejecutar un reporte real.
 *
 * Uso:  npm run dev  →  http://localhost:3000/dev/pdf-preview
 *
 * IMPORTANTE — react-pdf NO corre en el server: aunque esta página es
 * 'use client', Next.js la evalúa también en SSR. Por eso NO importamos nada
 * del report-kit (que arrastra @react-pdf/renderer) en el tope del módulo:
 * todo se carga con import() dinámico DENTRO del useEffect, que solo corre
 * en el browser. Importarlo estático arriba = 500 (Internal Server Error).
 *
 * SOLO desarrollo: el middleware deja pasar /dev/* únicamente cuando
 * NODE_ENV !== 'production', y la página se auto-bloquea en producción.
 */

import { useEffect, useState } from 'react'

export default function PdfPreviewPage() {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    let objectUrl: string | null = null
    let cancelled = false
    ;(async () => {
      try {
        // Imports dinámicos: solo se cargan en el browser, nunca en SSR.
        const { documentToObjectUrl } = await import('@/lib/pdf/report-kit')
        const { DemoReportDocument } = await import('@/lib/pdf/report-kit/_demo')
        const u = await Promise.race([
          documentToObjectUrl(<DemoReportDocument />),
          new Promise<string>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Timeout: el PDF tardó más de 30s en generarse.\n' +
                      'Probable causa: una fuente o una imagen remota que no termina de cargar.',
                  ),
                ),
              30000,
            ),
          ),
        ])
        if (cancelled) {
          URL.revokeObjectURL(u)
          return
        }
        objectUrl = u
        setUrl(u)
      } catch (e) {
        setError(e instanceof Error ? `${e.message}\n\n${e.stack ?? ''}` : String(e))
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        Esta página solo está disponible en desarrollo.
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1 style={{ color: '#E53935', fontSize: 18 }}>Error generando el PDF de muestra</h1>
        <pre
          style={{
            marginTop: 12,
            padding: 16,
            background: '#FFF5F5',
            border: '1px solid #E53935',
            borderRadius: 8,
            color: '#7f1d1d',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          {error}
        </pre>
        <p style={{ marginTop: 12, color: '#666' }}>Pasame este error y lo resuelvo.</p>
      </div>
    )
  }

  if (!url) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>Generando PDF de muestra…</div>
    )
  }

  return (
    <div style={{ height: '100vh', width: '100%', background: '#525659' }}>
      <iframe
        src={url}
        title="Preview del reporte (report-kit)"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}
