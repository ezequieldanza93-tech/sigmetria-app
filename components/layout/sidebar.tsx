'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Building2,
  Users,
  UsersRound,
  Network,
  Shield,
  Gauge,
  UserCog,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard/empresas', label: 'Empresas', icon: Building2 },
  { href: '/dashboard/personas', label: 'Personas', icon: Users },
  { href: '/dashboard/equipo', label: 'Equipo', icon: UsersRound },
  { href: '/dashboard/organizaciones-externas', label: 'Organizaciones', icon: Network },
  { href: '/dashboard/productos', label: 'Productos EPP', icon: Shield },
  { href: '/dashboard/instrumentos', label: 'Instrumentos', icon: Gauge },
  { href: '/dashboard/usuarios', label: 'Usuarios', icon: UserCog },
]

const BOTTOM_ITEMS = [
  { href: '/dashboard/configuracion/catalogacion', label: 'Catalogación', icon: Settings2 },
]

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
  onCollapsedChange?: (collapsed: boolean) => void
}

export function Sidebar({ mobileOpen, onMobileClose, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sigmetria.sidebar.collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sigmetria.sidebar.collapsed', String(next))
    onCollapsedChange?.(next)
  }

  function isActive(href: string) {
    if (href === '/dashboard/empresas') return pathname.startsWith('/dashboard/empresas')
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col sidebar-transition',
          'bg-surface-sidebar border-r border-border-subtle',
          // Width
          collapsed ? 'lg:w-16' : 'lg:w-[260px]',
          'w-[260px]',
          // Mobile: off-canvas drawer; desktop: always visible
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo area */}
        <div
          className={cn(
            'flex items-center h-14 px-4 border-b border-border-subtle shrink-0',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
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
          {collapsed && <SigmetriaIsotipo />}

          {/* Mobile close button */}
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
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <NavItem
                  href={href}
                  label={label}
                  icon={<Icon size={18} strokeWidth={1.75} />}
                  active={isActive(href)}
                  collapsed={collapsed}
                  onClick={onMobileClose}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom items */}
        <div className="border-t border-border-subtle py-3 px-2">
          <ul className="space-y-0.5 mb-2">
            {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <NavItem
                  href={href}
                  label={label}
                  icon={<Icon size={18} strokeWidth={1.75} />}
                  active={isActive(href)}
                  collapsed={collapsed}
                  onClick={onMobileClose}
                />
              </li>
            ))}
          </ul>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={toggleCollapsed}
            className={cn(
              'hidden lg:flex items-center gap-2 w-full rounded-lg px-2 py-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors',
              collapsed && 'justify-center',
            )}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
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

interface NavItemProps {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
  collapsed: boolean
  onClick?: () => void
}

function NavItem({ href, label, icon, active, collapsed, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-muted text-brand-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
        collapsed && 'justify-center px-2',
      )}
      title={collapsed ? label : undefined}
    >
      {/* Active indicator */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-primary rounded-r-full" />
      )}
      <span
        className={cn(
          'shrink-0',
          active ? 'text-brand-primary' : 'text-text-tertiary group-hover:text-text-primary',
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="sidebar-label-transition truncate">{label}</span>}

      {/* Tooltip on collapsed */}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated border border-border-subtle rounded-md text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-md z-50 transition-opacity">
          {label}
        </span>
      )}
    </Link>
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
