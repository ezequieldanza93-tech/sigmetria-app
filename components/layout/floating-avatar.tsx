'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { UserRole, SystemRole } from '@/lib/types'
import { AvatarMenuContent } from '@/components/layout/avatar-menu-items'
import { type SwitchableRole } from '@/lib/actions/change-role'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { canAccessContenido } from '@/lib/contenido/access'

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
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const [roleSimOpen, setRoleSimOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const showMarketing = canAccessContenido(userRole, systemRole)
  const showReportes = userRole === 'full_access_main' || userRole === 'responsable_estandares' || isSuperAdmin

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
            'w-64 bg-surface-elevated',
            'border border-border-subtle',
            'rounded-2xl shadow-2xl',
            'z-50 overflow-hidden',
            'max-h-[80vh] overflow-y-auto',
            'animate-in fade-in slide-in-from-top-2 duration-150',
          )}
        >
          <AvatarMenuContent
            fullName={fullName}
            email={email}
            consultoraNombre={consultoraNombre}
            userRole={userRole}
            systemRole={systemRole}
            isSuperAdmin={isSuperAdmin}
            simulatedRole={simulatedRole}
            canSwitchRole={canSwitchRole}
            hideKeyboardShortcuts={isMobile}
            roleSimOpen={roleSimOpen}
            onRoleSimOpenChange={setRoleSimOpen}
            onSignOut={handleLogout}
            showMarketing={showMarketing}
            showReportes={showReportes}
            onMenuClose={() => setMenuOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
