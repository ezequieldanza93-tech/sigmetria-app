'use client'

import { useState, useEffect } from 'react'
import { Shield, Copy, Check, Loader2, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MfaSetupPage() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(true)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function enroll() {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error || !data) {
        setError('No se pudo iniciar la configuración. Intentá de nuevo más tarde.')
        setEnrolling(false)
        return
      }
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setFactorId(data.id)
      setEnrolling(false)
    }
    enroll()
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (error) {
      setError('Código incorrecto. Verificá que tu dispositivo esté sincronizado e intentá de nuevo.')
      setLoading(false)
      return
    }
    router.replace('/dashboard/empresas')
  }

  async function handleCopy() {
    if (!secret) return
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary/10 rounded-2xl mb-4">
            <Shield size={28} className="text-brand-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">
            Verificación en dos pasos
          </h1>
          <p className="text-text-secondary text-sm mt-2 max-w-sm mx-auto">
            Tu rol requiere verificación en dos pasos para acceder a Sigmetría.
            Escaneá el código QR con Google Authenticator o Authy.
          </p>
        </div>

        {enrolling ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Cargando configuración">
            <Loader2 size={32} className="animate-spin text-brand-primary" aria-hidden="true" />
          </div>
        ) : error && !qrCode ? (
          <div
            role="alert"
            className="flex items-center gap-3 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3"
          >
            <AlertCircle size={18} className="flex-shrink-0" aria-hidden="true" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {qrCode && (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-4 rounded-xl border border-border-default inline-block">
                  <img
                    src={qrCode}
                    alt="Código QR para configurar autenticación en dos pasos"
                    width={180}
                    height={180}
                    className="block"
                  />
                </div>
                <p className="text-xs text-text-tertiary text-center">
                  Escaneá este código con tu app autenticadora
                </p>
              </div>
            )}

            {secret && (
              <div>
                <p className="text-xs text-text-tertiary mb-2 text-center">
                  ¿No podés escanear? Ingresá este código manualmente:
                </p>
                <div className="flex items-center gap-2 bg-surface-elevated border border-border-default rounded-lg px-3 py-2">
                  <code className="flex-1 text-xs text-text-primary font-mono break-all select-all">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={copied ? 'Copiado' : 'Copiar clave secreta'}
                    className="flex-shrink-0 p-1 text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    {copied
                      ? <Check size={14} className="text-green-500" aria-hidden="true" />
                      : <Copy size={14} aria-hidden="true" />
                    }
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="totp-code"
                  className="block text-sm font-medium text-text-primary mb-2"
                >
                  Código de verificación
                </label>
                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  aria-describedby={error ? 'setup-error' : undefined}
                  aria-invalid={!!error}
                  className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
                  required
                />
                <p className="text-xs text-text-tertiary mt-1.5">
                  Ingresá el código de 6 dígitos que muestra tu app autenticadora.
                </p>
              </div>

              {error && (
                <div
                  id="setup-error"
                  role="alert"
                  className="flex items-center gap-2 text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2.5"
                >
                  <AlertCircle size={14} className="flex-shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  'Activar verificación en dos pasos'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
