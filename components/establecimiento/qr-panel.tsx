'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, RefreshCw } from 'lucide-react'
import { regenerarTokenEstablecimiento } from '@/lib/actions/verificacion'

interface QRPanelProps {
  token: string
  establecimientoId: string
  empresaId: string
  establecimientoNombre: string
}

export function QRPanel({ token, establecimientoId, empresaId, establecimientoNombre }: QRPanelProps) {
  const [currentToken, setCurrentToken] = useState(token)
  const [origin, setOrigin] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  const url = origin ? `${origin}/verificar/${currentToken}` : ''

  function handleDownload() {
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    const fecha = new Date().toISOString().split('T')[0]
    const nombre = establecimientoNombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    a.download = `legajo-${nombre}-${fecha}.png`
    a.click()
  }

  function handleRegenerar() {
    if (!confirm('¿Regenerar el QR? El código anterior dejará de funcionar y no se puede deshacer.')) return
    setError(null)
    startTransition(async () => {
      const result = await regenerarTokenEstablecimiento(establecimientoId, empresaId)
      if (result.success && result.token) {
        setCurrentToken(result.token)
      } else {
        setError(result.error ?? 'Error al regenerar el token')
      }
    })
  }

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Código QR del Legajo</h3>
        <span className="text-xs text-text-tertiary">Art. 4.5 SRT 48/2025</span>
      </div>

      <div className="flex flex-col items-center gap-3">
        {url ? (
          <div ref={containerRef} className="p-3 bg-white rounded-xl border border-border-subtle">
            <QRCodeCanvas
              value={url}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>
        ) : (
          <div className="w-[204px] h-[204px] bg-surface-base rounded-xl border border-border-subtle animate-pulse" />
        )}

        <p className="text-xs text-text-tertiary text-center max-w-[220px] break-all">
          {url || '—'}
        </p>
      </div>

      {error && (
        <p className="text-xs text-danger bg-[var(--danger-bg)] rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={!url}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-brand-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Download size={13} />
          Descargar PNG
        </button>
        <button
          onClick={handleRegenerar}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border border-border-subtle text-text-secondary hover:bg-surface-base transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Regenerando...' : 'Regenerar QR'}
        </button>
      </div>
    </div>
  )
}
