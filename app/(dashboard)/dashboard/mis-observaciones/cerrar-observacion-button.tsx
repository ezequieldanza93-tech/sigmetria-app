'use client'

import { useRef, useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cerrarMiObservacion } from '@/lib/actions/mis-observaciones'

export function CerrarObservacionButton({ observacionId }: { observacionId: string }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fotoRef = useRef<HTMLInputElement>(null)
  const adjuntoRef = useRef<HTMLInputElement>(null)

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  function submit() {
    if (!file) { setError('Subí una foto o adjuntá un archivo.'); return }
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('evidencia', file)
      const result = await cerrarMiObservacion(observacionId, fd)
      if (!result.success) setError(result.error)
      // En éxito, revalidatePath refresca la lista y la observación pasa a "cerradas".
    })
  }

  if (!open) {
    return (
      <div className="mt-3">
        <Button size="sm" onClick={() => setOpen(true)}>Cerrar observación</Button>
      </div>
    )
  }

  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-elevated transition-colors'

  return (
    <div className="mt-3 rounded-lg border border-border-default p-3 space-y-3">
      <p className="text-xs text-text-secondary">
        Para cerrar necesitás subir <strong>una foto o un adjunto</strong> (obligatorio).
      </p>
      {error && <div className="text-xs text-danger">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => fotoRef.current?.click()} className={btn}>📷 Tomar / subir foto</button>
        <button type="button" onClick={() => adjuntoRef.current?.click()} className={btn}>📎 Adjuntar archivo</button>
        <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        <input ref={adjuntoRef} type="file" className="hidden" onChange={pick} />
      </div>

      {file && (
        <p className="text-xs text-success flex items-center gap-1">
          <Check size={14} /> {file.name}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={submit} disabled={isPending || !file}>
          {isPending ? <><Loader2 size={14} className="animate-spin" /> Cerrando…</> : 'Confirmar cierre'}
        </Button>
        <button
          type="button"
          onClick={() => { setOpen(false); setFile(null); setError(null) }}
          className="text-xs text-text-tertiary hover:text-text-secondary"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
