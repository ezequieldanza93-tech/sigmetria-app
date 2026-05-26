'use client'

import { useState, useMemo } from 'react'
import { Keyboard, Search, AlertTriangle, Info } from 'lucide-react'
import {
  SHORTCUT_DEFS,
  SHORTCUT_CATEGORIES,
  type ShortcutDef,
  type ShortcutCategory,
} from '@/lib/constants/shortcuts'
import { cn } from '@/lib/utils'

// ── Keyboard key visual ───────────────────────────────────────────────────────

function Key({ k }: { k: string }) {
  return (
    <kbd className={cn(
      'inline-flex items-center justify-center',
      'min-w-[28px] h-7 px-2',
      'text-[11px] font-mono font-semibold',
      'rounded-md',
      'border border-border-default',
      'bg-surface-sunken text-text-secondary',
      'shadow-[0_2px_0_var(--border-default)]',
      'select-none',
    )}>
      {k}
    </kbd>
  )
}

function KeyCombo({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-text-tertiary text-xs font-light">+</span>}
          <Key k={k} />
        </span>
      ))}
    </div>
  )
}

// ── Single shortcut row ───────────────────────────────────────────────────────

function ShortcutRow({ def }: { def: ShortcutDef }) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-4 px-4 py-3',
      'rounded-lg transition-colors',
      'hover:bg-surface-sunken/60',
      'group',
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{def.label}</span>
          {def.contextual && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-muted text-brand-primary">
              Contextual
            </span>
          )}
        </div>
        <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">{def.description}</p>
        {def.note && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertTriangle size={11} className="text-warning shrink-0 mt-0.5" />
            <p className="text-[11px] text-warning leading-relaxed">{def.note}</p>
          </div>
        )}
      </div>
      <KeyCombo keys={def.keysDisplay} />
    </div>
  )
}

// ── Category section ──────────────────────────────────────────────────────────

const CATEGORY_DESCRIPTIONS: Record<ShortcutCategory, string> = {
  Navegación: 'Moverse rápidamente entre secciones de la app',
  Gestión: 'Acciones sobre gestiones del establecimiento activo',
  Observaciones: 'Flujos de campo y reporte fotográfico',
  SIGIA: 'Asistente de inteligencia artificial integrado',
  Sistema: 'Historial de navegación y utilidades globales',
}

function CategorySection({
  category,
  defs,
}: {
  category: ShortcutCategory
  defs: ShortcutDef[]
}) {
  if (defs.length === 0) return null

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
          {category}
        </h2>
        <p className="text-xs text-text-tertiary/70 mt-0.5">
          {CATEGORY_DESCRIPTIONS[category]}
        </p>
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface-base overflow-hidden divide-y divide-border-subtle/50">
        {defs.map(def => (
          <ShortcutRow key={def.action} def={def} />
        ))}
      </div>
    </div>
  )
}

// ── Main reference component ──────────────────────────────────────────────────

export function ShortcutsReference() {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return SHORTCUT_DEFS
    return SHORTCUT_DEFS.filter(
      d =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.keysDisplay.some(k => k.toLowerCase().includes(q)),
    )
  }, [search])

  const byCategory = useMemo(
    () =>
      SHORTCUT_CATEGORIES.reduce<Record<ShortcutCategory, ShortcutDef[]>>(
        (acc, cat) => {
          acc[cat] = filtered.filter(d => d.category === cat)
          return acc
        },
        { Navegación: [], Gestión: [], Observaciones: [], SIGIA: [], Sistema: [] },
      ),
    [filtered],
  )

  const totalVisible = filtered.length

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20">
          <Keyboard size={22} className="text-brand-primary" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-heading">
            Atajos de Teclado
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Acelerá tu flujo de trabajo en desktop — disponibles únicamente con mouse + teclado
          </p>
        </div>

        {/* Standard format badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated border border-border-subtle text-xs text-text-secondary">
          <Info size={12} className="text-brand-primary" />
          Todos los atajos usan el estándar&nbsp;
          <KeyCombo keys={['Ctrl', 'Shift', 'Letra']} />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar atajo..."
          className="w-full bg-surface-base border border-border-default rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-shadow"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
            {totalVisible} resultado{totalVisible !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Sections */}
      {totalVisible === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-secondary font-medium">Sin resultados</p>
          <p className="text-sm text-text-tertiary mt-1">
            Probá buscando por nombre, categoría o tecla
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {SHORTCUT_CATEGORIES.map(cat => (
            <CategorySection key={cat} category={cat} defs={byCategory[cat]} />
          ))}
        </div>
      )}

      {/* Contextual note */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 flex gap-3">
        <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-text-primary">Atajos contextuales</p>
          <p className="text-xs text-text-tertiary leading-relaxed">
            Los atajos marcados como <span className="font-medium text-brand-primary">Contextual</span> solo
            funcionan dentro de la vista específica del establecimiento. Si presionás el atajo fuera
            de contexto, verás una notificación indicando que debés navegar a la sección correspondiente.
          </p>
        </div>
      </div>

      {/* Desktop only note */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 flex gap-3">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Solo desktop</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            Los atajos de teclado están habilitados exclusivamente en dispositivos desktop con mouse
            y teclado (pantallas ≥1024px, puntero fino). En mobile y tablet la app funciona con
            la interfaz táctil habitual.
          </p>
        </div>
      </div>
    </div>
  )
}
