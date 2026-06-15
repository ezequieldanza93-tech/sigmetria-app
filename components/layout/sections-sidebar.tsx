'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, ChevronsRight, ChevronsLeft, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SectionChild {
  id: string
  label: string
  href: string
}

export interface SectionItem {
  id: string
  label: string
  icon: LucideIcon
  href?: string
  children?: SectionChild[]
  defaultOpen?: boolean
}

const COLLAPSED_WIDTH = 56
const MIN_WIDTH = 80
const MAX_WIDTH = 240

interface Props {
  items: SectionItem[]
  marketingItems?: SectionItem[]
  activeId: string | null
  expanded: boolean
  expandedWidth: number
  onToggle: () => void
  onWidthChange: (w: number) => void
  onResizingChange: (v: boolean) => void
  ariaLabel: string
}

export function SectionsSidebar({
  items,
  marketingItems,
  activeId,
  expanded,
  expandedWidth,
  onToggle,
  onWidthChange,
  onResizingChange,
  ariaLabel,
}: Props) {
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const it of items) {
      if (it.children) init[it.id] = it.defaultOpen ?? false
    }
    return init
  })

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
      aria-label={ariaLabel}
    >
      <nav className="flex flex-col py-3 px-2 gap-0.5 flex-1 overflow-y-auto">
        {items.map(item => {
          const { id, label, icon: Icon, href, children } = item
          const isActive = activeId === id
          const isExpandable = !!children && children.length > 0
          const isOpen = expanded && (openSubs[id] ?? false)

          const triggerInner = (
            <div
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
                <span className="text-sm whitespace-nowrap truncate flex-1">{label}</span>
              )}
              {expanded && isExpandable && (
                <ChevronDown
                  size={14}
                  className={cn('shrink-0 transition-transform', isOpen && 'rotate-180')}
                />
              )}
            </div>
          )

          return (
            <div key={id} className="relative group/item">
              {href ? (
                <Link
                  href={href}
                  onClick={() => {
                    if (isExpandable) setOpenSubs(s => ({ ...s, [id]: !(s[id] ?? false) }))
                  }}
                >
                  {triggerInner}
                </Link>
              ) : (
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => isExpandable && setOpenSubs(s => ({ ...s, [id]: !(s[id] ?? false) }))}
                >
                  {triggerInner}
                </button>
              )}

              {!expanded && (
                <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs font-medium bg-surface-elevated border border-border-subtle rounded-lg text-text-primary shadow-md whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 z-50">
                  {label}
                </span>
              )}

              {isExpandable && isOpen && (
                <ul className="mt-1 ml-7 mb-1 space-y-0.5 border-l border-border-subtle pl-2">
                  {children!.map(child => (
                    <li key={child.id}>
                      <Link
                        href={child.href}
                        className="block text-xs text-text-tertiary hover:text-text-primary hover:bg-surface-elevated rounded px-2 py-1 truncate"
                        title={child.label}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      {marketingItems && marketingItems.length > 0 && (
        <div className="px-2 pb-1">
          <div className="h-px bg-border-subtle mb-2" />
          {expanded && (
            <p className="px-2 pb-1 text-xs font-medium text-text-tertiary uppercase tracking-wide select-none">
              Marketing
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {marketingItems.map(item => {
              const { id, label, icon: Icon, href } = item
              const isActive = activeId === id
              const inner = (
                <div
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
                    <span className="text-sm whitespace-nowrap truncate flex-1">{label}</span>
                  )}
                </div>
              )
              return (
                <div key={id} className="relative group/item">
                  {href ? (
                    <Link href={href}>{inner}</Link>
                  ) : (
                    <button type="button" className="w-full text-left">{inner}</button>
                  )}
                  {!expanded && (
                    <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs font-medium bg-surface-elevated border border-border-subtle rounded-lg text-text-primary shadow-md whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 z-50">
                      {label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-2 pb-4">
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center rounded-lg px-2 py-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors text-xs font-medium',
            expanded ? 'justify-start gap-1.5' : 'justify-center',
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
