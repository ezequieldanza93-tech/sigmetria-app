'use client'

import { useActionState, useState } from 'react'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { DemoCredentials } from '@/components/demo-credentials'
import { login, signup } from '@/lib/actions/login'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const [loginState, loginAction, loginPending] = useActionState<
    { error?: string } | undefined,
    FormData
  >(login, undefined)

  const [signupState, signupAction, signupPending] = useActionState<
    { error?: string; success?: boolean } | undefined,
    FormData
  >(signup, undefined)

  const pending = loginPending || signupPending

  return (
    <div className="min-h-screen bg-surface-base flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-hover" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="mb-8">
            <SigmetriaLogo className="h-16 w-16 text-white" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-heading font-bold text-white mb-4">
            Sigmetría HyS
          </h1>
          <p className="text-lg text-white/90 max-w-md leading-relaxed">
            Plataforma integral de gestión en Higiene y Seguridad laboral.
            Simplificá la administración de inspecciones, siniestros y documentación.
          </p>
          <div className="mt-12 flex items-center gap-8 text-white/80 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/80" />
              <span>Inspecciones</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/80" />
              <span>Siniestros</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/80" />
              <span>Analytics</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary rounded-2xl mb-4">
              <SigmetriaLogo className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-text-primary">Sigmetría HyS</h1>
            <p className="text-text-secondary text-sm mt-1">Plataforma de Higiene y Seguridad</p>
          </div>

          {/* Mode toggle */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-heading font-bold text-text-primary">
              {mode === 'login' ? 'Bienvenido' : 'Crear cuenta'}
            </h2>
            <p className="text-text-secondary mt-1">
              {mode === 'login'
                ? 'Ingresá tus credenciales para acceder'
                : 'Completá los datos para registrarte'}
            </p>
          </div>

          {mode === 'login' ? (
            <>
              <form action={loginAction} className="space-y-5">
                {loginState?.error && (
                  <div
                    role="alert"
                    className="flex items-center gap-3 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3"
                  >
                    <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium">{loginState.error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-text-primary text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="usuario@empresa.com"
                    className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-text-primary text-sm font-medium mb-2">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Ingresá tu contraseña"
                    className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loginPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Ingresando...</span>
                    </>
                  ) : (
                    'Ingresar'
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-text-tertiary mt-6">
                ¿No tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-brand-primary hover:text-brand-hover font-medium transition-colors"
                >
                  Crear cuenta
                </button>
              </p>

              <DemoCredentials />
            </>
          ) : (
            <>
              {signupState?.success ? (
                <div className="text-center py-6 space-y-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 dark:bg-green-950 rounded-full">
                    <CheckCircle2 size={28} className="text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">¡Cuenta creada!</h3>
                  <p className="text-sm text-text-secondary">
                    Tu cuenta está lista. Ya podés iniciar sesión con tu email y contraseña.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-sm font-medium text-white bg-brand-primary hover:bg-brand-hover px-4 py-2 rounded-lg transition-colors"
                  >
                    Iniciar sesión
                  </button>
                </div>
              ) : (
                <form action={signupAction} className="space-y-5">
                  {signupState?.error && (
                    <div
                      role="alert"
                      className="flex items-center gap-3 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3"
                    >
                      <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium">{signupState.error}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="full_name" className="block text-text-primary text-sm font-medium mb-2">
                      Nombre completo
                    </label>
                    <input
                      id="full_name"
                      name="full_name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Juan Pérez"
                      className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-email" className="block text-text-primary text-sm font-medium mb-2">
                      Email
                    </label>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="usuario@empresa.com"
                      className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-password" className="block text-text-primary text-sm font-medium mb-2">
                      Contraseña
                    </label>
                    <input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {signupPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Creando cuenta...</span>
                      </>
                    ) : (
                      'Crear cuenta'
                    )}
                  </button>
                </form>
              )}

              {!signupState?.success && (
                <p className="text-center text-sm text-text-tertiary mt-6">
                  ¿Ya tenés cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-brand-primary hover:text-brand-hover font-medium transition-colors"
                  >
                    Iniciá sesión
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SigmetriaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 4L44 40H4L24 4Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M24 4L34 24H14L24 4Z" fill="currentColor" fillOpacity="0.4" />
      <path d="M24 12L29 22H19L24 12Z" fill="currentColor" />
      <path d="M10 32H38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 38H34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
