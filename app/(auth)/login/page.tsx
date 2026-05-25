'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Bug } from 'lucide-react'
import { DemoCredentials } from '@/components/demo-credentials'

const LOGIN_TIMEOUT = 8_000

interface LogEntry {
  t: string
  msg: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showDebug, setShowDebug] = useState(false)

  const addLog = useCallback((msg: string) => {
    const entry = { t: new Date().toISOString().slice(11, 23), msg }
    console.warn('[LOGIN-DEBUG]', entry.t, msg)
    setLogs(prev => [...prev.slice(-49), entry])
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setLogs([])
    addLog('Submit clicked')

    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      addLog('TIMEOUT fired after 8s')
      setLoading(false)
      setError('Tiempo de espera agotado. Verificá tu conexión.')
      console.error('[LOGIN-DEBUG] Timeout reached — fetch never completed')
    }, LOGIN_TIMEOUT)

    try {
      addLog('Calling fetch POST /api/auth/login...')
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      addLog(`Fetch returned status ${res.status}`)

      if (timedOut) { addLog('Ignored — timed out'); return }
      clearTimeout(timeout)

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Error de conexión' }))
        addLog(`Error response: ${data.error}`)
        setError(data.error || 'Error de autenticación')
        setLoading(false)
        return
      }

      addLog('Login OK, redirecting...')
      router.push('/dashboard/empresas')
      router.refresh()
    } catch (e) {
      if (timedOut) { addLog('Ignored — timed out'); return }
      clearTimeout(timeout)
      const msg = e instanceof Error ? e.message : 'desconocido'
      addLog(`Catch error: ${msg}`)
      console.error('[LOGIN-DEBUG] Unhandled exception:', e)
      setError(`Error inesperado: ${msg}`)
      setLoading(false)
    }
  }

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

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div 
                role="alert"
                className="flex items-center gap-3 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">{error}</span>
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
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
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
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Ingresá tu contraseña"
                className="w-full bg-surface-base border border-border-default text-text-primary rounded-lg px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
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
          <button
            type="button"
            onClick={() => setShowDebug(o => !o)}
            className="mt-4 flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors mx-auto"
          >
            <Bug className="h-3 w-3" />
            {showDebug ? 'Ocultar debug' : 'Debug login'}
          </button>

          {showDebug && (
            <div className="mt-3 bg-gray-950 text-green-400 rounded-lg p-3 text-[11px] font-mono max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  Debug logs ({logs.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const text = logs.map(l => `[${l.t}] ${l.msg}`).join('\n')
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
