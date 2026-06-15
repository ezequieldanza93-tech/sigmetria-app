'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// Origen de un ítem de librería: base = genérico de Sigmetría (consultora_id IS NULL),
// propio = agregado por la consultora (consultora_id = X).
export type OrigenFiltro = 'todos' | 'base' | 'propios'

const OPCIONES: { id: OrigenFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'base', label: 'Base' },
  { id: 'propios', label: 'Agregados' },
]

// Filtro de origen. Por defecto se usa 'todos' (mostrar todo).
export function OrigenFilter({
  value,
  onChange,
  className,
}: {
  value: OrigenFiltro
  onChange: (v: OrigenFiltro) => void
  className?: string
}) {
  return (
    <div className={cn('flex gap-1', className)}>
      {OPCIONES.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
            value === o.id
              ? 'bg-sig-500 text-white border-sig-500'
              : 'border-border-default text-text-secondary hover:bg-surface-base',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Predicado: ¿el ítem pasa el filtro de origen?
export function pasaOrigen(consultoraId: string | null, filtro: OrigenFiltro): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'base') return consultoraId === null
  return consultoraId !== null
}

// Badge que identifica el origen del ítem (Base de Sigmetría vs agregado por la consultora).
export function OrigenBadge({ consultoraId }: { consultoraId: string | null }) {
  return consultoraId === null
    ? <Badge variant="info" className="shrink-0">Base</Badge>
    : <Badge variant="success" className="shrink-0">Propio</Badge>
}
