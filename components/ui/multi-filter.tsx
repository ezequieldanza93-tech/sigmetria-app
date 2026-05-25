'use client'
import { useEffect, useRef, useState } from 'react'

export function MultiFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: Set<string>
  onChange: (v: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allSelected = selected.size === options.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border-default rounded-lg bg-surface-base text-text-secondary hover:bg-surface-elevated transition-colors whitespace-nowrap"
      >
        {label}
        <span className="text-[10px] text-text-tertiary">
          {allSelected ? 'todos' : `${selected.size}/${options.length}`}
        </span>
        <svg className={`w-3 h-3 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 min-w-[200px] bg-surface-elevated border border-border-default rounded-xl shadow-xl overflow-hidden">
          {options.map(opt => {
            const isOn = selected.has(opt.value)
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface-sunken cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => {
                    const next = new Set(selected)
                    if (isOn) { next.delete(opt.value) } else { next.add(opt.value) }
                    onChange(next)
                  }}
                  className="rounded border-border-default text-brand-primary focus:ring-brand-primary/30"
                />
                {opt.label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
