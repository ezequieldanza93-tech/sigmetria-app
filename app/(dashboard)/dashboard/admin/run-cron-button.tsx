'use client'

import { useState, useTransition } from 'react'
import { Play } from 'lucide-react'

export function RunCronButton() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRun() {
    startTransition(async () => {
      setResult(null)
      setError(null)
      try {
        const res = await fetch('/api/admin/run-cron', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Error desconocido')
          return
        }
        setResult(data.result)
      } catch {
        setError('Error de red')
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRun}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-50"
      >
        <Play size={14} strokeWidth={1.75} />
        {isPending ? 'Ejecutando…' : 'Ejecutar cron'}
      </button>
      {result && (
        <span className="text-xs text-text-tertiary font-mono">
          {JSON.stringify(result)}
        </span>
      )}
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  )
}
