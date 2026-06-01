'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  UserCog,
  Gauge,
  CreditCard,
  Users,
  Network,
  Shield,
  GraduationCap,
  BookOpen,
  BarChart2,
  Settings2,
  CalendarClock,
  ClipboardList,
  MessageSquare,
  Map,
  ShieldCheck,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useNavigationLevel } from '@/lib/hooks/use-navigation-level'
import { cn } from '@/lib/utils'
import { UserRole, SystemRole } from '@/lib/types'
import { RoleSwitcher } from '@/components/layout/role-switcher'
import { type SwitchableRole } from '@/lib/actions/change-role'

interface FloatingAvatarProps {
  fullName: string
  email: string
  consultoraNombre: string | null
  userRole: UserRole | null
  systemRole: SystemRole
  isSuperAdmin?: boolean
  simulatedRole?: SwitchableRole | null
  canSwitchRole?: boolean
}

export function FloatingAvatar({
  fullName,
  email,
  consultoraNombre,
  userRole,
  systemRole,
  isSuperAdmin = false,
  simulatedRole = null,
  canSwitchRole = false,
}: FloatingAvatarProps) {
  const router = useRouter()
  const { level } = useNavigationLevel()
  const [menuOpen, setMenuOpen] = useState(false)
  const [roleSimOpen, setRoleSimOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Only show on mobile/tablet, hidden at consultora level
  const isVisible = level !== 'consultora'

  const initials = fullName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!isVisible) return null

  return (
    <div
      ref={menuRef}
      className="fixed top-3 right-3 z-50 lg:hidden"
    >
      {/* Avatar button */}
      <button
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls="floating-user-menu"
        className={cn(
          'w-10 h-10 rounded-full',
          'flex items-center justify-center',
          'text-xs font-bold',
          'shadow-lg',
          'transition-all duration-200',
          menuOpen
            ? 'bg-brand-primary text-white scale-110 shadow-brand-primary/20'
            : 'bg-surface-elevated text-text-secondary hover:bg-brand-muted hover:text-brand-primary hover:scale-105',
          'backdrop-blur-sm border border-border-subtle/50',
        )}
        aria-label="Menú de usuario"
      >
        {initials || '?'}
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          id="floating-user-menu"
          role="menu"
          aria-label="Menú de usuario"
          className={cn(
            'absolute right-0 top-full mt-2',
            'w-64 bg-surface-elevated/98 backdrop-blur-md',
            'border border-border-subtle',
            'rounded-2xl shadow-2xl',
            'z-50 overflow-hidden',
            'animate-in fade-in slide-in-from-top-2 duration-150',
          )}
        >
          {/* User info */}
          <div className="px-4 py-3.5 border-b border-border-subtle">
            <p className="text-sm font-medium text-text-primary truncate">{fullName}</p>
            <p className="text-xs text-text-tertiary truncate mt-0.5">{email}</p>
            {consultoraNombre && (
              <p className="text-[11px] text-brand-primary font-medium mt-1">
                {consultoraNombre}
              </p>
            )}
          </div>

          <RoleSwitcher
            currentRole={userRole}
            systemRole={systemRole}
            isSuperAdmin={isSuperAdmin}
            simulatedRole={simulatedRole}
            canSwitchRole={canSwitchRole}
            open={roleSimOpen}
            onOpenChange={setRoleSimOpen}
          />

          {/* Menu items — same structure as AppHeader */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Consultora */}
            <MenuGroup label="Consultora">
              <MenuItem href="/dashboard/configuracion/consultora" icon={Building2} label="Información" />
              <MenuItem href="/dashboard/instrumentos" icon={Gauge} label="Instrumentos" />
              <MenuItem href="/dashboard/usuarios" icon={UserCog} label="Usuarios" />
              <MenuItem href="/dashboard/billing" icon={CreditCard} label="Suscripción" />
            </MenuGroup>

            {/* Directorio */}
            <MenuGroup label="Directorio">
              <MenuItem href="/dashboard/personas" icon={Users} label="Personas" />
              <MenuItem href="/dashboard/organizaciones-externas" icon={Network} label="Organizaciones" />
            </MenuGroup>

            {/* Librerías */}
            <MenuGroup label="Librerías">
              <MenuItem href="/dashboard/productos" icon={Shield} label="Elementos de Protección" />
              <MenuItem href="/dashboard/configuracion/iperc" icon={ClipboardList} label="Librería IPERC" />
            </MenuGroup>

            {/* Capacitación */}
            <MenuGroup label="Capacitación">
              <MenuItem href="/dashboard/cursos" icon={GraduationCap} label="Mis Cursos" />
              {(userRole === 'full_access_main' || userRole === 'full_access_branch' || isSuperAdmin) && (
                <>
                  <MenuItem href="/dashboard/cursos/admin" icon={BookOpen} label="Administrar Cursos" />
                  <MenuItem href="/dashboard/cursos/compliance" icon={BarChart2} label="Compliance" />
                </>
              )}
            </MenuGroup>

            {/* Herramientas */}
            <MenuGroup label="Herramientas">
              <MenuItem href="/dashboard/analytics" icon={BarChart2} label="Analytics" />
              <MenuItem href="/dashboard/configuracion/catalogacion" icon={Settings2} label="Catalogación" />
              <MenuItem href="/dashboard/configuracion/vencimientos" icon={CalendarClock} label="Vencimientos" />
              <MenuItem href="/dashboard/configuracion/feedback" icon={MessageSquare} label="Feedback" />
              <MenuItem href="/dashboard/mapas" icon={Map} label="Mapa de Riesgos" />
              {isSuperAdmin && (
                <>
                  <MenuItem href="/dashboard/admin" icon={ShieldCheck} label="Super Admin" />
                  <MenuItem href="/dashboard/admin/feedback" icon={MessageSquare} label="Feedback Admin" />
                </>
              )}
            </MenuGroup>
          </div>

          {/* Logout */}
          <div className="border-t border-border-subtle">
            <button
              onClick={handleLogout}
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
            >
              <LogOut size={16} strokeWidth={1.75} className="text-text-tertiary" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1 border-b border-border-subtle last:border-b-0">
      <div className="px-4 py-1.5">
        <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
          {label}
        </p>
      </div>
      {children}
    </div>
  )
}

function MenuItem({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
    >
      <span className="text-text-tertiary shrink-0">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      {label}
    </Link>
  )
}
