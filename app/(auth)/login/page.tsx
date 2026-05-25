'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { AlertCircle, Loader2, Bug } from 'lucide-react'
import { DemoCredentials } from '@/components/demo-credentials'
import { login } from '@/lib/actions/login'

interface LogEntry {
  t: string
  msg: string
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<
    { error?: string } | undefined,
    FormData
  >(login, undefined)
  const [showDebug, setShowDebug] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const addLog = (msg: string) => {
    const entry = { t: new Date().toISOString().slice(11, 23), msg }
    setLogs((prev) => [...prev.slice(-49), entry])
  }

  // Track pending state to log form submission lifecycle
  const prevPending = useRef(false)
  useEffect(() => {
    if (!prevPending.current && pending) {
      addLog('Form submitted, waiting for server action...')
      timeoutRef.current = setTimeout(() => {
        addLog('⚠ TIMEOUT: 8s elapsed without server response')
      }, 8000)
    } else if (prevPending.current && !pending) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (state?.error) {
        addLog(`Error from server: ${state.error}`)
      }
    }
    prevPending.current = pending
  }, [pending, state?.error])

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
        {/* Decorative elements */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
      </div>

      {/* Right Panel - Login Form */}
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

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-heading font-bold text-text-primary">
              Bienvenido
            </h2>
            <p className="text-text-secondary mt-1">
              Ingresá tus credenciales para acceder
            </p>
          </div>

          <form action={formAction} className="space-y-5">
            {state?.error && (
              <div 
                role="alert"
                className="flex items-center gap-3 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">{state.error}</span>
              </div>
            )}

            <div>
              <label 
                htmlFor="email" 
                className="block text-text-primary text-sm font-medium mb-2"
              >
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
              <label 
                htmlFor="password" 
                className="block text-text-primary text-sm font-medium mb-2"
              >
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
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Ingresando...</span>
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <DemoCredentials />

          {/* Debug button */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowDebug((o) => !o)}
              className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <Bug className="h-3 w-3" />
              {showDebug ? 'Ocultar debug' : 'Debug login'}
            </button>

            {showDebug && (
              <div className="mt-3 bg-gray-950 text-green-400 rounded-lg p-3 text-[11px] font-mono max-h-64 overflow-y-auto text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                    Logs ({logs.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const text = logs.map((l) => `[${l.t}] ${l.msg}`).join('\n')
                      navigator.clipboard.writeText(text || '(sin logs)')
                    }}
                    className="text-gray-500 hover:text-white transition-colors text-[10px] uppercase tracking-wider"
                  >
                    Copiar
                  </button>
                </div>
                {logs.length === 0 && (
                  <p className="text-gray-600 italic">Completá el formulario y presioná Ingresar</p>
                )}
                {logs.map((l, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-gray-600">[{l.t}]</span>{' '}
                    <span className="text-green-300">{l.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
      <path
        d="M24 4L44 40H4L24 4Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M24 4L34 24H14L24 4Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <path
        d="M24 12L29 22H19L24 12Z"
        fill="currentColor"
      />
      <path
        d="M10 32H38"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 38H34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
