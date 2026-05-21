'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ClipboardList, FileText, BarChart3, Crosshair, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'agenda' | 'ficha' | 'dashboard' | 'seguimiento' | 'analytics'

const ITEMS: { id: Section; label: string; icon: typeof FileText }[] = [
  { id: 'ficha', label: 'Ficha', icon: FileText },
  { id: 'agenda', label: 'Gestiones', icon: ClipboardList },
  { id: 'seguimiento', label: 'Seguimiento', icon: Crosshair },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
]

interface Props {
  empresaId: string
  establecimientoId: string
}

export function SeccionesSidebar({ empresaId, establecimientoId }: Props) {
  const searchParams = useSearchParams()
  const activeSection = (searchParams.get('section') ?? 'agenda') as Section

  const baseUrl = `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`

  return (
    <aside
      className="hidden lg:flex peer/sidebar group fixed top-14 left-0 bottom-0 z-20 border-r border-border-subtle bg-surface-base flex-col w-14 hover:w-32 transition-[width] duration-200 overflow-hidden"
      aria-label="Secciones del establecimiento"
    >
      <nav className="flex flex-col py-3 px-2 gap-0.5">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeSection === id
          const href = id === 'agenda' ? baseUrl : `${baseUrl}?section=${id}`
          return (
            <Link
              key={id}
              href={href}
              className={cn(
                'relative flex items-center gap-2 rounded-lg px-2 py-2.5 transition-colors',
                isActive
                  ? 'bg-brand-muted text-brand-primary'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated',
              )}
              title={label}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-primary rounded-r-full" />
              )}
              <span className="shrink-0">
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className="text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity truncate">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
