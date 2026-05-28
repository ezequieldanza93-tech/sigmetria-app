'use client'

import { useState, useTransition } from 'react'
import { createApiKey, revokeApiKey } from './actions'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permisos: string[]
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

interface Props {
  keys: ApiKey[]
  isAdmin: boolean
}

export function ApiKeysClient({ keys: initialKeys, isAdmin }: Props) {
  const [keys, setKeys] = useState(initialKeys)
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [revoking, setRevoking] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createApiKey(name)
      if ('error' in result) {
        setError(result.error)
      } else {
        setNewKey(result.key)
        setName('')
      }
    })
  }

  async function handleRevoke(keyId: string) {
    setRevoking(keyId)
    const result = await revokeApiKey(keyId)
    if (result.error) {
      setError(result.error)
    } else {
      setKeys(prev => prev.map(k => k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k))
    }
    setRevoking(null)
  }

  function handleCopy() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const activeKeys = keys.filter(k => !k.revoked_at)
  const revokedKeys = keys.filter(k => k.revoked_at)

  return (
    <div className="space-y-6">

      {/* Banner de nueva key — solo se muestra una vez */}
      {newKey && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-yellow-900">Guardá esta clave ahora — no se va a mostrar de nuevo</p>
              <p className="text-xs text-yellow-700 mt-0.5">Una vez que cierres este aviso, la clave no podrá recuperarse.</p>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-yellow-600 hover:text-yellow-900 text-lg leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-yellow-100 border border-yellow-200 px-3 py-2">
            <code className="flex-1 text-xs font-mono text-yellow-900 break-all select-all">{newKey}</code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md bg-yellow-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-yellow-700 transition-colors"
            >
              {copied ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {/* Crear nueva key */}
      {isAdmin && (
        <section className="rounded-xl border border-border-subtle bg-surface-base p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Nueva API Key</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre (ej: Sistema de RRHH)"
              className="flex-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              maxLength={80}
              required
            />
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isPending ? 'Creando...' : 'Crear key'}
            </button>
          </form>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </section>
      )}

      {/* Keys activas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Keys activas ({activeKeys.length})</h2>
        {activeKeys.length === 0
          ? <p className="text-sm text-text-tertiary">Sin keys activas.</p>
          : (
            <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-base overflow-hidden">
              {activeKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-text-primary truncate">{k.name}</p>
                    <p className="text-xs font-mono text-text-tertiary">{k.key_prefix}••••••••••••••••••••••••••••••••••••••••••••••••</p>
                    <p className="text-xs text-text-tertiary">
                      Creada {new Date(k.created_at).toLocaleDateString('es-AR')}
                      {k.last_used_at && ` · Último uso ${new Date(k.last_used_at).toLocaleDateString('es-AR')}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                      className="shrink-0 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-medium px-3 py-1.5 hover:bg-red-100 transition-colors disabled:opacity-40"
                    >
                      {revoking === k.id ? 'Revocando...' : 'Revocar'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </section>

      {/* Keys revocadas */}
      {revokedKeys.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text-tertiary">Keys revocadas ({revokedKeys.length})</h2>
          <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-base overflow-hidden opacity-60">
            {revokedKeys.map(k => (
              <div key={k.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm text-text-secondary line-through truncate">{k.name}</p>
                  <p className="text-xs font-mono text-text-tertiary">{k.key_prefix}••••••••</p>
                  <p className="text-xs text-text-tertiary">
                    Revocada {k.revoked_at ? new Date(k.revoked_at).toLocaleDateString('es-AR') : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold px-2 py-0.5 uppercase">Revocada</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
