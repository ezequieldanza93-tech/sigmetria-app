'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ClipboardList, FileText, BarChart3, Crosshair } from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'agenda' | 'ficha' | 'dashboard' | 'seguimiento'

const ITEMS: { id: Section; label: string; icon: typeof FileText }[] = [
  { id: 'ficha', label: 'Ficha', icon: FileText },
  { id: 'agenda', label: 'Gestiones', icon: ClipboardList },
  { id: 'seguimiento', label: 'Seguimiento', icon: Crosshair },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
]

interface Props {
  empresaId: string
  establecimientoId: string
}

export function SeccionesBottomNav({ empresaId, establecimientoId }: Props) {
  const searchParams = useSearchParams()
  const activeSection = (searchParams.get('section') ?? 'agenda') as Section

  const baseUrl = `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-base/95 backdrop-blur border-t border-border-subtle flex justify-around"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Secciones del establecimiento"
    >
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = activeSection === id
        const href = id === 'agenda' ? baseUrl : `${baseUrl}?section=${id}`
        return (
          <Link
            key={id}
            href={href}
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center py-2.5 transition-colors',
              isActive
                ? 'text-brand-primary'
                : 'text-text-tertiary hover:text-text-primary',
            )}
            aria-label={label}
            title={label}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-primary rounded-b" />
            )}
            <Icon size={22} strokeWidth={1.75} />
            {isActive && (
              <span className="text-[10px] font-medium mt-0.5">{label}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
