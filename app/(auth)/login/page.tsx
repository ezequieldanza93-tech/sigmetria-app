'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    await supabase.rpc('cache_user_permissions')

    router.push('/dashboard/empresas')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-sig-500 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Sigmetría HyS</h1>
          <p className="text-slate-400 text-sm mt-1">Plataforma de Higiene y Seguridad</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="usuario@sigmetria.app"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sig-500 hover:bg-sig-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 bg-slate-800/50 rounded-xl p-4">
          <p className="text-slate-400 text-xs font-medium mb-2">Usuarios de demo (contraseña: Demo1234!)</p>
          <div className="space-y-1 text-xs text-slate-500">
            <div>dev@sigmetria.app — Developer</div>
            <div>admin.main@sigmetria.app — Admin Principal</div>
            <div>admin.branch@sigmetria.app — Admin Branch</div>
            <div>colaborador@sigmetria.app — Colaborador</div>
            <div>viewer@sigmetria.app — Viewer Global</div>
            <div>colaborador.viewer@sigmetria.app — Viewer Limitado</div>
          </div>
        </div>
      </div>
    </div>
  )
}
