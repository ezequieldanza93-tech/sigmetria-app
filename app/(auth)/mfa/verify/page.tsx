'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MfaVerifyPage() {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const router = useRouter()

  const initChallenge = useCallback(async () => {
    setInitializing(true)
    setError(null)
    setCode('')
    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totp = factors?.totp?.[0]

    if (!totp) {
      router.replace('/mfa/setup')
      return
    }

    setFactorId(totp.id)
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totp.id })

    if (challengeError || !challenge) {
      setError('No se pudo iniciar el proceso de verificación. Intentá de nuevo.')
    } else {
      setChallengeId(challenge.id)
    }

    setInitializing(false)
  }, [router])

  useEffect(() => {
    initChallenge()
  }, [initChallenge])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || !challengeId || code.length !== 6) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })

    if (error) {
      setError('Código incorrecto o expirado. Obtené un código nuevo de tu app autenticadora.')
      setLoading(false)
      return
    }

    router.replace('/dashboard/empresas')
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary/10 rounded-2xl mb-4">
            <ShieldCheck size={28} className="text-brand-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">
            Verificación en dos pasos
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            Abrí tu app autenticadora e ingresá el código de 6 dígitos.
          </p>
        </div>

        {initializing ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Cargando">
            <Loader2 size={28} className="animate-spin text-brand-primary" aria-hidden="true" />
          </div>
        ) : (
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
                className="flex items-start gap-2 text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2.5"
              >
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
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
                'Verificar'
              )}
            </button>

            <button
              type="button"
              onClick={initChallenge}
              disabled={initializing}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary py-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Solicitar un nuevo código
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
