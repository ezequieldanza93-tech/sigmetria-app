'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import type { ComponentType } from 'react'

export interface ViewOption<T extends string = string> {
  value: T
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
}

interface ViewSelectorProps<T extends string = string> {
  options: ViewOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}

export function ViewSelector<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
}: ViewSelectorProps<T>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const current = options.find(o => o.value === value) ?? options[0]
  const CurrentIcon = current.icon

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(v => !v)
  }

  return (
    <div ref={triggerRef} className={`hidden md:block ${className}`}>
      <button
        onClick={handleToggle}
        className={`text-xs border rounded-lg px-2 py-1.5 flex items-center gap-1.5 transition-colors ${
          open
            ? 'border-sig-300 bg-sig-50 text-sig-700'
            : 'border-border-subtle text-text-secondary hover:bg-surface-base'
        }`}
      >
        <CurrentIcon size={12} />
        <span>{current.label}</span>
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[150px]"
        >
          {options.map(opt => {
            const Icon = opt.icon
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-sig-50 text-sig-700 font-medium'
                    : 'text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <Icon size={13} />
                <span className="flex-1 text-left">{opt.label}</span>
                {isSelected && <Check size={11} className="shrink-0" />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
