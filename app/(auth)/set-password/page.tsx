'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { KeyRound, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SessionState = 'checking' | 'ready' | 'no-session'

export default function SetPasswordPage() {
  const router = useRouter()
  const [sessionState, setSessionState] = useState<SessionState>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  // verifyOtp (en /auth/confirm) ya dejó la sesión en cookies. Confirmamos que
  // exista antes de mostrar el form: sin sesión no se puede setear contraseña.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth
      .getUser()
      .then(({ data }) => setSessionState(data.user ? 'ready' : 'no-session'))
      .catch(() => setSessionState('no-session'))
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    startSave(async () => {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message || 'No se pudo guardar la contraseña. Probá de nuevo.')
        return
      }
      // El MFA (si el rol lo requiere) se resuelve después, en el flujo normal:
      // el middleware redirige a /mfa/verify cuando corresponde.
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary/10 rounded-2xl mb-4">
            <KeyRound size={28} className="text-brand-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">
            Definí tu contraseña
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            Elegí una contraseña para tu cuenta y empezá a usar Sigmetría HyS.
          </p>
        </div>

        {sessionState === 'checking' && (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Verificando invitación">
            <Loader2 size={28} className="animate-spin text-brand-primary" aria-hidden="true" />
          </div>
        )}

        {sessionState === 'no-session' && (
          <div className="space-y-4 text-center">
            <div
              role="alert"
              className="flex items-start gap-2 text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-4 py-3 text-left"
            >
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                El link de invitación venció o ya fue usado. Pedile a quien te invitó que genere
                uno nuevo.
              </span>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-brand-primary hover:bg-brand-hover px-4 py-2.5 rounded-lg transition-colors"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        )}

        {sessionState === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-text-primary mb-2">
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                minLength={8}
                autoFocus
                required
                className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-text-primary mb-2">
                Repetí la contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repetí la contraseña"
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2.5"
              >
                <AlertCircle size={14} className="flex-shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Lock size={16} aria-hidden="true" />
                  <span>Guardar contraseña</span>
                </>
              )}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary pt-1">
              <CheckCircle2 size={12} className="flex-shrink-0" aria-hidden="true" />
              Vas a quedar dentro de tu consultora con el rol asignado.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
