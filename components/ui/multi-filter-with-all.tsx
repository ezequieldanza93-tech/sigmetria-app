'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'

export interface MultiFilterOption {
  value: string
  label: string
}

interface Props {
  label: string
  options: MultiFilterOption[]
  // Empty Set means "Todos" is active. Non-empty Set means individual selection.
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

// Multiselect con opción "Todos" persistente al fondo.
// - selected vacío = "Todos" activo (sin filtro).
// - Seleccionar individuales desactiva "Todos".
// - Click en "Todos" limpia la selección y reactiva "Todos".
export function MultiFilterWithAll({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(v => !v)
  }

  const allActive = selected.size === 0
  const summary = allActive ? 'todos' : `${selected.size}/${options.length}`

  function toggleOne(value: string) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    // Si el usuario quitó el último, vuelve a "todos".
    onChange(next)
  }

  function selectAll() {
    onChange(new Set())
  }

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border-default rounded-lg bg-surface-base text-text-secondary hover:bg-surface-elevated transition-colors whitespace-nowrap"
      >
        {label}
        <span className="text-[10px] text-text-tertiary">{summary}</span>
        <svg
          className={`w-3 h-3 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[220px] max-h-80 overflow-y-auto bg-surface-elevated border border-border-default rounded-xl shadow-xl"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-tertiary italic">Sin opciones</div>
          ) : (
            options.map(opt => {
              const isOn = selected.has(opt.value)
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface-sunken cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggleOne(opt.value)}
                    className="rounded border-border-default text-brand-primary focus:ring-brand-primary/30"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              )
            })
          )}
          <button
            type="button"
            onClick={selectAll}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium border-t border-border-subtle transition-colors ${
              allActive
                ? 'bg-brand-muted text-brand-primary cursor-default'
                : 'text-text-secondary hover:bg-surface-sunken'
            }`}
            disabled={allActive}
          >
            {allActive ? <Check size={12} /> : <span className="w-3" />}
            Todos
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
