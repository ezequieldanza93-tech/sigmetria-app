'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

/**
 * Ícono ⓘ con tooltip que SÍ funciona en mobile.
 *
 * Reemplaza el patrón `<span title="...">` nativo, que no se muestra en
 * dispositivos táctiles (ni en elementos no-focusables). Acá el contenido
 * aparece al hover en desktop Y al tap en mobile (toggle), con cierre al
 * tocar afuera.
 */
export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <span ref={rootRef} className={`relative inline-flex group/info ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Más información"
        className="inline-flex items-center text-text-tertiary hover:text-text-secondary focus:outline-none cursor-help"
      >
        <Info size={14} />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 max-w-[80vw] -translate-x-1/2 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-xs font-normal normal-case leading-relaxed text-text-primary shadow-lg transition-opacity duration-150 group-hover/info:opacity-100 ${open ? 'opacity-100' : 'opacity-0'}`}
      >
        {text}
      </span>
    </span>
  )
}
