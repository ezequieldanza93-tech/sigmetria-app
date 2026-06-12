'use client'

import { useState, useEffect, useTransition } from 'react'
import { Mail, Loader2, AlertCircle, RefreshCw, CheckCircle2, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendMfaEmailCode, verifyMfaEmailCode } from '@/lib/actions/mfa-email'

export default function MfaVerifyPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [isSending, startSend] = useTransition()
  const [isVerifying, startVerify] = useTransition()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Envío automático al cargar
  useEffect(() => {
    handleSend()
  }, [])

  // Timer de cooldown para reenvío
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function handleSend() {
    setSendError(null)
    startSend(async () => {
      const result = await sendMfaEmailCode()
      if (result.error) {
        setSendError(result.error)
      } else {
        setEmailSent(true)
        setCooldown(60)
      }
    })
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return
    setError(null)
    startVerify(async () => {
      const result = await verifyMfaEmailCode(code)
      if (result.error) {
        setError(result.error)
        setCode('')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    })
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary/10 rounded-2xl mb-4">
            <Mail size={28} className="text-brand-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">
            Verificación en dos pasos
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            Te enviamos un código de 6 dígitos a tu email registrado.
            <span className="block mt-1 text-text-tertiary">
              Si no lo ves en unos minutos, revisá la carpeta de <strong>spam</strong> o correo no deseado.
            </span>
          </p>
        </div>

        {isSending && !emailSent ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Enviando código">
            <Loader2 size={28} className="animate-spin text-brand-primary" aria-hidden="true" />
          </div>
        ) : (
          <>
            {emailSent && (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2.5 mb-4">
                <CheckCircle2 size={14} className="flex-shrink-0" aria-hidden="true" />
                Código enviado. Revisá tu bandeja de entrada (y la carpeta de spam si no lo ves).
              </div>
            )}

            {sendError && (
              <div
                role="alert"
                className="flex items-center gap-2 text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2.5 mb-4"
              >
                <AlertCircle size={14} className="flex-shrink-0" aria-hidden="true" />
                {sendError}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="otp-code"
                  className="block text-sm font-medium text-text-primary mb-2"
                >
                  Código de verificación
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                  aria-describedby={error ? 'verify-error' : undefined}
                  aria-invalid={!!error}
                  className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
                  required
                />
              </div>

              {error && (
                <div
                  id="verify-error"
                  role="alert"
                  className="flex items-center gap-2 text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2.5"
                >
                  <AlertCircle size={14} className="flex-shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || code.length !== 6}
                className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  'Verificar'
                )}
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || cooldown > 0}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={12} aria-hidden="true" />
                {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-border-subtle text-center">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <LogOut size={12} aria-hidden="true" />
            )}
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
