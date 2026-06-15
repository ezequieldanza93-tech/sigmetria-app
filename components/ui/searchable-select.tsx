'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  /** Valor seleccionado (controlado). */
  value: string
  /** Se llama con el nuevo value cuando el usuario elige una opción (o limpia). */
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  label?: string
  error?: string
  /** true = campo válido → borde verde. Se ignora si hay error. */
  valid?: boolean
  required?: boolean
  id?: string
  /**
   * Si se provee, se renderiza un <input type="hidden" name={name}> con el value
   * para que el SELECT participe del submit nativo de <form action>.
   */
  name?: string
  /** Texto cuando el filtro no devuelve resultados. */
  emptyText?: string
}

/**
 * SELECT single con buscador de texto, accesible por teclado.
 * No usa dependencias externas — patrón propio basado en el combobox de
 * cierre-observacion-modal. Filtra las opciones por el texto tipeado.
 *
 * Teclado: ↑/↓ navega, Enter selecciona, Esc cierra, Tab cierra.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  disabled = false,
  label,
  error,
  valid,
  required,
  id,
  name,
  emptyText = 'Sin resultados.',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const listboxId = selectId ? `${selectId}-listbox` : undefined

  const selectedOption = options.find(o => o.value === value)
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? options.filter(o => o.label.toLowerCase().includes(normalizedQuery))
    : options

  // Cierra al click afuera.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Al abrir: foco al input y resetea el índice activo a la opción seleccionada.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      const idx = filtered.findIndex(o => o.value === value)
      setActiveIndex(idx >= 0 ? idx : 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Mantiene el índice activo dentro de rango cuando cambia el filtro.
  useEffect(() => {
    setActiveIndex(prev => (prev >= filtered.length ? 0 : prev))
  }, [filtered.length])

  // Scroll para mantener visible la opción activa.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function openMenu() {
    if (disabled) return
    setOpen(true)
  }

  function selectOption(opt: Option) {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) { openMenu(); return }
        setActiveIndex(prev => Math.min(prev + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) { openMenu(); return }
        setActiveIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (open && filtered[activeIndex]) selectOption(filtered[activeIndex])
        else openMenu()
        break
      case 'Escape':
        if (open) {
          e.preventDefault()
          setOpen(false)
          setQuery('')
        }
        break
      case 'Tab':
        if (open) {
          setOpen(false)
          setQuery('')
        }
        break
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text-secondary">
          {label}
          {required && <span className="text-[var(--danger)] ml-1">*</span>}
        </label>
      )}

      <div ref={rootRef} className="relative">
        {/* Valor para el submit nativo del form. */}
        {name && <input type="hidden" name={name} value={value} />}

        {/* Botón-trigger que muestra el valor elegido. */}
        <button
          type="button"
          id={selectId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full flex items-center gap-2 border border-border-default rounded-lg px-3 py-2 text-sm text-left bg-surface-base',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent',
            'disabled:bg-surface-sunken disabled:text-text-tertiary disabled:cursor-not-allowed',
            error && 'border-[var(--danger)] focus-visible:ring-[var(--danger)]',
            valid && !error && 'border-green-500',
          )}
        >
          <span className={cn('flex-1 truncate', !selectedOption && 'text-text-tertiary')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpiar selección"
              onClick={clear}
              className="text-text-tertiary hover:text-text-primary shrink-0"
            >
              <X className="w-4 h-4" />
            </span>
          )}
          <ChevronDown
            className={cn('w-4 h-4 text-text-tertiary shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-surface-base border border-border-default rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
              <Search className="w-4 h-4 text-text-tertiary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar…"
                aria-label="Buscar opción"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={
                  filtered[activeIndex] && listboxId
                    ? `${listboxId}-opt-${activeIndex}`
                    : undefined
                }
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-text-tertiary text-center">{emptyText}</div>
            ) : (
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label={label}
                className="max-h-60 overflow-y-auto py-1"
              >
                {filtered.map((opt, idx) => {
                  const isSelected = opt.value === value
                  const isActive = idx === activeIndex
                  return (
                    <li
                      key={opt.value}
                      id={listboxId ? `${listboxId}-opt-${idx}` : undefined}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => selectOption(opt)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-text-primary',
                        isActive && 'bg-surface-sunken',
                      )}
                    >
                      <span className="flex-1 truncate">{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-brand-primary shrink-0" />}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  )
}
