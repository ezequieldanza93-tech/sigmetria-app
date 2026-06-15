'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { aceptarConsentimientoGeo } from '@/lib/actions/consentimiento'

/**
 * Modal BLOQUEANTE de consentimiento de geo-sello.
 *
 * - No tiene botón X ni se cierra al hacer clic en el backdrop.
 * - El único camino de salida es el botón "Entendido y continuar".
 * - Se muestra la primera vez que un usuario con rol operativo entra al dashboard
 *   (cuando profiles.accepted_geo_consent_at IS NULL).
 * - Al aceptar, llama a aceptarConsentimientoGeo() y oculta el modal localmente.
 *   La revalidación del layout asegura que en la próxima navegación server-side
 *   tampoco vuelva a renderizarse.
 */
export function GeoConsentModal() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [visible, setVisible] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (visible) {
      // showModal() para que quede por encima de todo (top-layer nativo).
      // Usamos requestAnimationFrame para evitar el frame en que el DOM
      // aún no pintó el dialog (necesario en React 19 concurrent mode).
      requestAnimationFrame(() => {
        if (!dialog.open) dialog.showModal()
      })
    } else {
      if (dialog.open) dialog.close()
    }
  }, [visible])

  async function handleAceptar() {
    setLoading(true)
    setError(null)
    const result = await aceptarConsentimientoGeo()
    if ('error' in result) {
      setError('No se pudo registrar tu aceptación. Volvé a intentar.')
      setLoading(false)
      return
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="geo-consent-title"
      aria-describedby="geo-consent-desc"
      // Cancelar con Escape está bloqueado — el modal es obligatorio.
      onCancel={(e) => e.preventDefault()}
      // Clic fuera del panel no cierra — onClose solo ocurre al cerrar por código.
      className="
        bg-transparent p-0 m-0 max-w-none max-h-none w-full h-full
        backdrop:bg-black/50 backdrop:backdrop-blur-sm
        overflow-hidden
      "
    >
      {/* Centrador flex — ocupa todo el viewport del top-layer */}
      <div className="flex min-h-full min-w-full items-center justify-center p-4">
        {/* Panel del modal */}
        <div className="relative w-full max-w-md rounded-2xl border border-border-subtle bg-surface-base shadow-[var(--shadow-lg)] flex flex-col gap-5 p-6">
          {/* Cabecera */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <MapPin size={18} strokeWidth={1.75} />
            </span>
            <div>
              <h2
                id="geo-consent-title"
                className="text-base font-semibold text-text-primary"
              >
                Aviso: registro de ubicación
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Leé esto antes de continuar
              </p>
            </div>
          </div>

          {/* Cuerpo */}
          <div
            id="geo-consent-desc"
            className="space-y-3 text-sm text-text-secondary leading-relaxed"
          >
            <p>
              Cuando completás una gestión (checklists, protocolos, reportes),{' '}
              <strong className="text-text-primary">
                Sigmetría registra la ubicación de tu dispositivo
              </strong>{' '}
              en ese momento. Sirve para verificar dónde se realizó cada tarea —
              control de tu consultora y, si corresponde, de la SRT.
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                <span>
                  <strong className="text-text-primary">No bloquea tu trabajo:</strong>{' '}
                  si negás el permiso de ubicación o el GPS falla, igual podés completar
                  la gestión. Queda registrado que no se obtuvo la ubicación.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                <span>
                  Solo se registra <strong className="text-text-primary">al completar gestiones</strong>,
                  no de forma continua.
                </span>
              </li>
            </ul>
            <p>
              <a
                href="/legal/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Leer la Política de Privacidad
              </a>
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {/* Acción */}
          <button
            type="button"
            onClick={handleAceptar}
            disabled={loading}
            className="
              w-full rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-medium
              text-white transition-opacity hover:opacity-90 active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {loading ? 'Registrando...' : 'Entendido y continuar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
