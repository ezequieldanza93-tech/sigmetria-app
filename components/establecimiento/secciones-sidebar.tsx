'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ClipboardList, FileText, BarChart3, Crosshair, ChevronsRight, ChevronsLeft, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'agenda' | 'ficha' | 'dashboard' | 'seguimiento' | 'legajo'

const ITEMS: { id: Section; label: string; icon: typeof FileText }[] = [
  { id: 'ficha', label: 'Ficha', icon: FileText },
  { id: 'agenda', label: 'Gestiones', icon: ClipboardList },
  { id: 'seguimiento', label: 'Seguimiento de Observaciones', icon: Crosshair },
  { id: 'dashboard', label: 'Dashboards', icon: BarChart3 },
  { id: 'legajo', label: 'Legajo QR', icon: QrCode },
]

const COLLAPSED_WIDTH = 56
const MIN_WIDTH = 80
const MAX_WIDTH = 240

interface Props {
  empresaId: string
  establecimientoId: string
  expanded: boolean
  expandedWidth: number
  onToggle: () => void
  onWidthChange: (w: number) => void
  onResizingChange: (v: boolean) => void
}

export function SeccionesSidebar({
  empresaId,
  establecimientoId,
  expanded,
  expandedWidth,
  onToggle,
  onWidthChange,
  onResizingChange,
}: Props) {
  const searchParams = useSearchParams()
  const activeSection = (searchParams.get('section') ?? 'agenda') as Section

  const baseUrl = `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = expandedWidth

    onResizingChange(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev: MouseEvent) {
      const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + (ev.clientX - startX)))
      onWidthChange(newW)
    }

    function onUp() {
      onResizingChange(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <aside
      className="hidden lg:flex fixed top-14 left-0 bottom-0 z-20 border-r border-border-subtle bg-surface-base flex-col transition-[width] duration-200 overflow-visible"
      style={{ width: expanded ? expandedWidth : COLLAPSED_WIDTH }}
      aria-label="Secciones del establecimiento"
    >
      <nav className="flex flex-col py-3 px-2 gap-0.5 flex-1">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeSection === id
          const href = id === 'agenda' ? baseUrl : `${baseUrl}?section=${id}`
          return (
            <div key={id} className="relative group/item">
              <Link
                href={href}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg px-2 py-2.5 transition-colors',
                  isActive
                    ? 'bg-brand-muted text-brand-primary'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-primary rounded-r-full" />
                )}
                <span className="shrink-0">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                {expanded && (
                  <span className="text-sm whitespace-nowrap truncate">{label}</span>
                )}
              </Link>
              {!expanded && (
                <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs font-medium bg-surface-elevated border border-border-subtle rounded-lg text-text-primary shadow-md whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 z-50">
                  {label}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      <div className="px-2 pb-4">
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center rounded-lg px-2 py-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors text-xs font-medium',
            expanded ? 'justify-start gap-1.5' : 'justify-center'
          )}
          aria-label={expanded ? 'Contraer sidebar' : 'Expandir sidebar'}
          title={expanded ? 'Contraer' : 'Expandir'}
        >
          {expanded ? (
            <>
              <ChevronsLeft size={15} />
              <span>Contraer</span>
            </>
          ) : (
            <ChevronsRight size={15} />
          )}
        </button>
      </div>

      {/* Drag handle — only visible when expanded */}
      {expanded && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sig-400 active:bg-sig-500 transition-colors group/resize"
          onMouseDown={handleResizeStart}
          title="Arrastrar para ajustar ancho"
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border-subtle opacity-0 group-hover/resize:opacity-100 transition-opacity" />
        </div>
      )}
    </aside>
  )
}
