'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { cambiarPasswordObligatorio } from '@/lib/actions/cambiar-password'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [state, formAction, pending] = useActionState<
    { error?: string; success?: boolean } | undefined,
    FormData
  >(cambiarPasswordObligatorio, undefined)

  useEffect(() => {
    if (state?.success) {
      router.replace('/dashboard')
      router.refresh()
    }
  }, [state, router])

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary/10 rounded-2xl mb-4">
            <ShieldCheck className="h-7 w-7 text-brand-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Creá tu contraseña</h1>
          <p className="text-text-secondary text-sm mt-2">
            Entraste con tu DNI. Por seguridad, elegí una contraseña personal antes de continuar.
          </p>
        </div>

        <form action={formAction} className="space-y-5 bg-surface-elevated border border-border-subtle rounded-2xl p-6">
          {state?.error && (
            <div role="alert" className="flex items-center gap-3 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium">{state.error}</span>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-text-primary text-sm font-medium mb-2">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={show ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-text-tertiary hover:text-text-secondary"
              >
                {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-text-primary text-sm font-medium mb-2">
              Repetí la contraseña
            </label>
            <input
              id="confirm"
              name="confirm"
              type={show ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Repetí la contraseña"
              className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Guardando…</span>
              </>
            ) : (
              'Guardar y continuar'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
