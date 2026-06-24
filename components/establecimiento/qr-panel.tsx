'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, RefreshCw, Lock, ShieldCheck, CalendarClock } from 'lucide-react'
import {
  regenerarTokenEstablecimiento,
  setRevocacionToken,
  setCaducidadToken,
} from '@/lib/actions/verificacion'

interface QRPanelProps {
  token: string
  establecimientoId: string
  empresaId: string
  establecimientoNombre: string
  /** ISO de revocación, o null si el QR está activo. */
  revokedAt?: string | null
  /** ISO de caducidad opcional, o null si es permanente. */
  expiresAt?: string | null
}

/** YYYY-MM-DD para el input[type=date] a partir de un ISO (o ''). */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toISOString().split('T')[0]
}

export function QRPanel({
  token, establecimientoId, empresaId, establecimientoNombre,
  revokedAt: revokedAtProp = null, expiresAt: expiresAtProp = null,
}: QRPanelProps) {
  const [currentToken, setCurrentToken] = useState(token)
  const [revokedAt, setRevokedAt] = useState<string | null>(revokedAtProp)
  const [expiresAt, setExpiresAt] = useState<string | null>(expiresAtProp)
  const [fechaCaducidad, setFechaCaducidad] = useState(toDateInput(expiresAtProp))
  const [origin, setOrigin] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  const url = origin ? `${origin}/verificar/${currentToken}` : ''
  const revocado = revokedAt !== null
  const caducado = expiresAt !== null && new Date(expiresAt) <= new Date()
  const inactivo = revocado || caducado

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
    if (!confirm('¿Regenerar el QR? El código anterior dejará de funcionar y no se puede deshacer. Se quitan la revocación y la caducidad.')) return
    setError(null)
    startTransition(async () => {
      const result = await regenerarTokenEstablecimiento(establecimientoId, empresaId)
      if (result.success && result.token) {
        setCurrentToken(result.token)
        setRevokedAt(null)
        setExpiresAt(null)
        setFechaCaducidad('')
      } else {
        setError(result.error ?? 'Error al regenerar el token')
      }
    })
  }

  function handleToggleRevocacion() {
    const revocar = !revocado
    if (revocar && !confirm('¿Revocar el QR? Dejará de funcionar para quien lo escanee. Podés reactivarlo cuando quieras (el código pegado en obra sigue siendo el mismo).')) return
    setError(null)
    startTransition(async () => {
      const result = await setRevocacionToken(establecimientoId, empresaId, revocar)
      if (result.success) setRevokedAt(revocar ? new Date().toISOString() : null)
      else setError(result.error ?? 'Error al cambiar la revocación')
    })
  }

  function handleGuardarCaducidad() {
    setError(null)
    // El input es fecha; la caducidad aplica al final de ese día (23:59:59 local).
    const iso = fechaCaducidad ? new Date(`${fechaCaducidad}T23:59:59`).toISOString() : null
    startTransition(async () => {
      const result = await setCaducidadToken(establecimientoId, empresaId, iso)
      if (result.success) setExpiresAt(iso)
      else setError(result.error ?? 'Error al guardar la caducidad')
    })
  }

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Código QR del Legajo</h3>
        <span className="text-xs text-text-tertiary">Art. 4.5 SRT 48/2025</span>
      </div>

      {/* Estado del QR */}
      <div
        className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
          inactivo
            ? 'bg-[var(--danger-bg)] text-danger'
            : 'bg-success/10 text-success'
        }`}
      >
        {inactivo ? <Lock size={14} /> : <ShieldCheck size={14} />}
        <span className="font-medium">
          {revocado ? 'QR revocado' : caducado ? 'QR caducado' : 'QR activo'}
        </span>
        {!inactivo && expiresAt && (
          <span className="text-text-tertiary">
            · caduca {new Date(expiresAt).toLocaleDateString('es-AR')}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        {url ? (
          <div
            ref={containerRef}
            className={`p-3 bg-white rounded-xl border border-border-subtle ${inactivo ? 'opacity-40' : ''}`}
          >
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
        <p className="text-[11px] text-text-tertiary text-center">
          El inspector ve solo documentos vigentes y puede abrir sus PDFs.
        </p>
      </div>

      {error && (
        <p className="text-xs text-danger bg-[var(--danger-bg)] rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Caducidad opcional */}
      <div className="space-y-1.5 border-t border-border-subtle pt-3">
        <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <CalendarClock size={13} />
          Caducidad (opcional)
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={fechaCaducidad}
            onChange={e => setFechaCaducidad(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-border-subtle rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <button
            onClick={handleGuardarCaducidad}
            disabled={isPending || toDateInput(expiresAt) === fechaCaducidad}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium border border-border-subtle text-text-secondary hover:bg-surface-base transition-colors disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
        <p className="text-[11px] text-text-tertiary">
          Dejalo vacío para que el QR sea permanente.
        </p>
      </div>

      {/* Acciones */}
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
          Regenerar
        </button>
      </div>

      <button
        onClick={handleToggleRevocacion}
        disabled={isPending}
        className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
          revocado
            ? 'border border-success/30 text-success hover:bg-success/10'
            : 'border border-danger/30 text-danger hover:bg-[var(--danger-bg)]'
        }`}
      >
        {revocado ? <ShieldCheck size={13} /> : <Lock size={13} />}
        {revocado ? 'Reactivar QR' : 'Revocar QR'}
      </button>
    </div>
  )
}
