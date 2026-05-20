'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Building2,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Factory,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Smartphone } from 'lucide-react'
import { usePreview } from '@/lib/contexts/preview-context'

interface EmpresaTree {
  id: string
  razon_social: string
  establecimientos: { id: string; nombre: string }[]
}

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
  onCollapsedChange?: (collapsed: boolean) => void
  isSuperAdmin?: boolean
}

export function Sidebar({ mobileOpen, onMobileClose, onCollapsedChange, isSuperAdmin }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const [empresas, setEmpresas] = useState<EmpresaTree[]>([])
  const [expandedEmpresa, setExpandedEmpresa] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sigmetria.sidebar.collapsed')
    setCollapsed(stored !== null ? stored === 'true' : true)
  }, [])

  const isCollapsed = collapsed && !sidebarHovered

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('empresas')
      .select('id, razon_social')
      .eq('is_active', true)
      .order('razon_social')
      .then(({ data: empData }) => {
        const empresasList = (empData ?? []) as { id: string; razon_social: string }[]
        if (empresasList.length === 0) { setEmpresas([]); return }

        const empresaIds = empresasList.map(e => e.id)

        supabase
          .from('establecimientos')
          .select('id, nombre, empresa_id')
          .in('empresa_id', empresaIds)
          .eq('status', 'active')
          .order('nombre')
          .then(({ data: estData }) => {
            const estMap = new Map<string, { id: string; nombre: string }[]>()
            for (const est of (estData ?? []) as { id: string; nombre: string; empresa_id: string }[]) {
              if (!estMap.has(est.empresa_id)) estMap.set(est.empresa_id, [])
              estMap.get(est.empresa_id)!.push({ id: est.id, nombre: est.nombre })
            }
            setEmpresas(empresasList.map(e => ({
              ...e,
              establecimientos: estMap.get(e.id) ?? [],
            })))
          })
      })
  }, [])

  // Auto-expand the empresa matching current route
  useEffect(() => {
    const match = pathname.match(/\/dashboard\/empresas\/([^/]+)/)
    if (match) {
      setExpandedEmpresa(match[1])
    }
  }, [pathname])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sigmetria.sidebar.collapsed', String(next))
    onCollapsedChange?.(next)
  }

  const activeEmpresaId = pathname.match(/\/dashboard\/empresas\/([^/]+)/)?.[1]
  const activeEstId = pathname.match(/\/dashboard\/empresas\/[^/]+\/establecimientos\/([^/]+)/)?.[1]

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col sidebar-transition',
          'bg-surface-sidebar border-r border-border-subtle',
          isCollapsed ? 'lg:w-16' : 'lg:w-[260px]',
          'w-[260px]',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        {/* Logo area */}
        <div
          className={cn(
            'flex items-center h-14 px-4 border-b border-border-subtle shrink-0',
            isCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <SigmetriaIsotipo />
              <div className="leading-tight">
                <span
                  className="text-sm font-bold text-text-primary tracking-tight"
                  style={{ fontFamily: 'Montserrat, system-ui' }}
                >
                  SIGMETRÍA
                </span>
                <span
                  className="text-xs text-text-tertiary block"
                  style={{ fontFamily: 'Poppins, system-ui' }}
                >
                  HyS Platform
                </span>
              </div>
            </div>
          )}
          {isCollapsed && <SigmetriaIsotipo />}

          <button
            className="lg:hidden text-text-tertiary hover:text-text-primary transition-colors"
            onClick={onMobileClose}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          <ul className="space-y-0.5">
            {/* Empresas tree */}
            <li>
              {isCollapsed ? (
                <Link
                  href="/dashboard/empresas"
                  className="group relative flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium transition-colors text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
                  title="Empresas"
                  onClick={onMobileClose}
                >
                  <Building2 size={18} strokeWidth={1.75} className="text-text-tertiary group-hover:text-text-primary shrink-0" />
                  <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated border border-border-subtle rounded-md text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-md z-50 transition-opacity">
                    Empresas
                  </span>
                </Link>
              ) : (
                <div className="space-y-0.5">
                  <Link
                    href="/dashboard/empresas"
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                      pathname === '/dashboard/empresas'
                        ? 'bg-brand-muted text-brand-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
                    )}
                  >
                    <Building2 size={18} strokeWidth={1.75} className="text-text-tertiary shrink-0" />
                    <span className="sidebar-label-transition truncate">Empresas</span>
                  </Link>

                  {empresas.map(emp => (
                    <div key={emp.id}>
                      <button
                        onClick={() => setExpandedEmpresa(expandedEmpresa === emp.id ? null : emp.id)}
                        className={cn(
                          'flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-colors text-left',
                          activeEmpresaId === emp.id && !activeEstId
                            ? 'bg-brand-muted/60 text-brand-primary'
                            : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-elevated',
                        )}
                      >
                        {expandedEmpresa === emp.id ? (
                          <ChevronDown size={14} strokeWidth={2} className="shrink-0" />
                        ) : (
                          <ChevronRight size={14} strokeWidth={2} className="shrink-0" />
                        )}
                        <Link
                          href={`/dashboard/empresas/${emp.id}`}
                          onClick={e => e.stopPropagation()}
                          className={cn(
                            'flex-1 truncate',
                            activeEmpresaId === emp.id && !activeEstId
                              ? 'text-brand-primary'
                              : 'text-text-tertiary hover:text-text-secondary',
                          )}
                        >
                          {emp.razon_social}
                        </Link>
                      </button>

                      {expandedEmpresa === emp.id && emp.establecimientos.length > 0 && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border-subtle pl-2">
                          {emp.establecimientos.map(est => (
                            <Link
                              key={est.id}
                              href={`/dashboard/empresas/${emp.id}/establecimientos/${est.id}`}
                              onClick={onMobileClose}
                              className={cn(
                                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                                activeEstId === est.id
                                  ? 'bg-brand-muted text-brand-primary'
                                  : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-elevated',
                              )}
                            >
                              <Factory size={14} strokeWidth={1.75} className="shrink-0" />
                              <span className="truncate">{est.nombre}</span>
                            </Link>
                          ))}
                          {emp.establecimientos.length === 0 && (
                            <span className="block px-2 py-1 text-xs text-text-tertiary italic">Sin establecimientos</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          </ul>
        </nav>

        {/* Bottom section — billing, admin, collapse */}
        <div className="border-t border-border-subtle py-3 px-2 space-y-0.5">
          <SidebarBottomLink
            href="/dashboard/billing"
            label="Suscripción"
            icon={<CreditCard size={18} strokeWidth={1.75} />}
            active={pathname.startsWith('/dashboard/billing')}
            collapsed={isCollapsed}
            onClick={onMobileClose}
          />
          {isSuperAdmin && (
            <SidebarBottomLink
              href="/dashboard/admin"
              label="Super Admin"
              icon={<ShieldCheck size={18} strokeWidth={1.75} />}
              active={pathname.startsWith('/dashboard/admin')}
              collapsed={isCollapsed}
              onClick={onMobileClose}
            />
          )}
          <SidebarPreviewButton collapsed={isCollapsed} />
          <button
            onClick={toggleCollapsed}
            className={cn(
              'hidden lg:flex items-center gap-2 w-full rounded-lg px-2 py-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors',
              isCollapsed && 'justify-center',
            )}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            title={collapsed ? 'Fijar expandido' : 'Volver a colapsar'}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose size={18} strokeWidth={1.75} />
                <span className="text-xs sidebar-label-transition">Colapsar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}

interface SidebarBottomLinkProps {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
  collapsed: boolean
  onClick?: () => void
}

function SidebarBottomLink({ href, label, icon, active, collapsed, onClick }: SidebarBottomLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-muted text-brand-primary'
          : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated',
        collapsed && 'justify-center',
      )}
      title={collapsed ? label : undefined}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-primary rounded-r-full" />
      )}
      <span className={cn('shrink-0', active ? 'text-brand-primary' : 'text-text-tertiary group-hover:text-text-primary')}>
        {icon}
      </span>
      {!collapsed && <span className="sidebar-label-transition truncate text-xs">{label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated border border-border-subtle rounded-md text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-md z-50 transition-opacity">
          {label}
        </span>
      )}
    </Link>
  )
}

function SidebarPreviewButton({ collapsed }: { collapsed: boolean }) {
  const { isOpen, setIsOpen } = usePreview()

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        'group relative flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm font-medium transition-colors',
        isOpen
          ? 'bg-brand-muted text-brand-primary'
          : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated',
        collapsed && 'justify-center',
      )}
      title={collapsed ? 'Preview Mobile' : undefined}
    >
      {isOpen && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-primary rounded-r-full" />
      )}
      <span className={cn('shrink-0', isOpen ? 'text-brand-primary' : 'text-text-tertiary group-hover:text-text-primary')}>
        <Smartphone size={18} strokeWidth={1.75} />
      </span>
      {!collapsed && <span className="sidebar-label-transition truncate text-xs">Preview Mobile</span>}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated border border-border-subtle rounded-md text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-md z-50 transition-opacity">
          Preview Mobile
        </span>
      )}
    </button>
  )
}

function SigmetriaIsotipo() {
  return (
    <svg viewBox="0 0 24 26" height="28" aria-hidden="true" className="shrink-0">
      <polygon points="12,1 1,25 12,25" fill="#4CAF50" />
      <polygon
        points="12,1 23,25 12,25"
        fill="none"
        stroke="var(--text-tertiary)"
        strokeWidth="1.5"
      />
    </svg>
  )
}
