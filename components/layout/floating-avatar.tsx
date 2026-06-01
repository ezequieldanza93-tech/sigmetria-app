'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart2,
  MessageSquare,
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
            {/* Herramientas */}
            <MenuGroup label="Herramientas">
              <MenuItem href="/dashboard/analytics" icon={BarChart2} label="Analytics" />
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
