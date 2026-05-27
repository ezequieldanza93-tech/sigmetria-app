'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Persona {
  id: string
  nombre: string
  apellido: string
  email: string | null
  dni: string | null
  personas_tipos?: { nombre: string } | null
}

interface PersonaSelectorProps {
  name: string
  value?: string | null
  onChange?: (value: string | null) => void
  placeholder?: string
}

export function PersonaSelector({ name, value, onChange, placeholder = 'Buscar persona…' }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Persona | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('consultora_members')
        .select('consultora_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!membership) return

      const { data: pd } = await supabase
        .from('personas_directorio')
        .select('id, nombre, apellido, email, dni, personas_tipos(nombre)')
        .eq('is_active', true)
        .order('apellido')

      const raw = (pd ?? []) as unknown as Persona[]
      setPersonas(raw)

      if (value) {
        const found = raw.find(p => p.id === value)
        if (found) setSelected(found)
      }
    }
    load()
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered = search.trim()
    ? personas.filter(p =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(search.toLowerCase()) ||
        p.apellido.toLowerCase().includes(search.toLowerCase()) ||
        p.dni?.includes(search)
      )
    : personas

  function select(p: Persona) {
    setSelected(p)
    setSearch(`${p.apellido}, ${p.nombre}`)
    setOpen(false)
    onChange?.(p.id)
  }

  function clear() {
    setSelected(null)
    setSearch('')
    setOpen(false)
    onChange?.(null)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="hidden"
        name={name}
        value={selected?.id ?? ''}
      />
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={selected ? `${selected.apellido}, ${selected.nombre}` : placeholder}
        className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base placeholder:text-text-tertiary"
      />
      {selected && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary text-sm"
        >
          ×
        </button>
      )}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-elevated border border-border-subtle rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-tertiary">Sin resultados</p>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-sunken transition-colors flex items-center justify-between ${selected?.id === p.id ? 'bg-sig-50 text-sig-700' : 'text-text-primary'}`}
              >
                <span>
                  <span className="font-medium">{p.apellido}</span>, {p.nombre}
                </span>
                <span className="text-xs text-text-tertiary shrink-0 ml-2">
                  {p.personas_tipos?.nombre ?? ''}{p.dni ? ` · ${p.dni}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
