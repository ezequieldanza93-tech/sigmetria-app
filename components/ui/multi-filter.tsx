'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

  const allSelected = selected.size === options.length

  return (
    <div ref={triggerRef}>
      <button
        onClick={handleToggle}
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
      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[200px] bg-surface-elevated border border-border-default rounded-xl shadow-xl overflow-hidden"
        >
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
        </div>,
        document.body
      )}
    </div>
  )
}
