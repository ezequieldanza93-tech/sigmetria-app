'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'

interface Props {
  empresaId: string
}

export function ExportEmpresaButton({ empresaId }: Props) {
  const [loading, setLoading] = useState(false)
  const { error } = useToast()

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/export/empresa/${empresaId}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.href = url
      a.download = match?.[1] ?? 'sigmetria_export.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al exportar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-1.5 border border-border-default text-text-tertiary hover:bg-surface-elevated hover:text-text-primary text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="size-3.5" />
      {loading ? 'Exportando…' : 'Exportar datos'}
    </button>
  )
}
