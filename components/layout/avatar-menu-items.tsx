'use client'

/**
 * AvatarMenuContent — contenido canónico del dropdown del avatar.
 * Fuente de verdad compartida entre AppHeader (desktop) y FloatingAvatar (mobile).
 *
 * Secciones:
 *  1. Info de usuario (nombre, email, consultora)
 *  2. RoleSwitcher
 *  3. Consultora (Usuarios, API Keys, Papelera) — gateado
 *  4. Herramientas (Super Admin, Feedback Admin) — solo isSuperAdmin
 *  5. Perfil y ayuda (Mi perfil, Seguridad, Tutoriales, Atajos)
 *  6. LanguageSwitcher
 *  7. Logout
 *
 * NO incluye navegación principal (Consultora / Directorio / Librerías).
 * Esos viven en la Ficha Global de consultora.
 */

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LogOut, ShieldCheck, MessageSquare, Keyboard, BookMarked, KeyRound, User, Users, Trash2, Gift, CreditCard, FileText, FileCheck } from 'lucide-react'
import { SystemRole, UserRole, canManageUsers } from '@/lib/types'
import { RoleSwitcher } from '@/components/layout/role-switcher'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { type SwitchableRole } from '@/lib/actions/change-role'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvatarMenuContentProps {
  fullName: string
  email: string
  consultoraNombre?: string | null
  userRole: UserRole | null
  systemRole: SystemRole
  isSuperAdmin?: boolean
  simulatedRole?: SwitchableRole | null
  canSwitchRole?: boolean
  /** Ocultar "Atajos de teclado" en mobile — defaults false */
  hideKeyboardShortcuts?: boolean
  /** Controla el sub-panel del role switcher */
  roleSimOpen: boolean
  onRoleSimOpenChange: (open: boolean) => void
  onSignOut: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AvatarMenuContent({
  fullName,
  email,
  consultoraNombre,
  userRole,
  systemRole,
  isSuperAdmin = false,
  simulatedRole = null,
  canSwitchRole = false,
  hideKeyboardShortcuts = false,
  roleSimOpen,
  onRoleSimOpenChange,
  onSignOut,
}: AvatarMenuContentProps) {
  const tNav = useTranslations('nav')

  const showConsultoraSection =
    userRole === 'full_access_main' ||
    canManageUsers(userRole, systemRole) ||
    isSuperAdmin

  return (
    <>
      {/* ── 1. Info de usuario ── */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <p className="text-sm font-medium text-text-primary truncate">{fullName}</p>
        <p className="text-xs text-text-tertiary truncate mt-0.5">{email}</p>
        {consultoraNombre && (
          <p className="text-[11px] text-brand-primary font-medium mt-1">{consultoraNombre}</p>
        )}
      </div>

      {/* ── 2. Role switcher ── */}
      <RoleSwitcher
        currentRole={userRole}
        systemRole={systemRole}
        isSuperAdmin={isSuperAdmin}
        simulatedRole={simulatedRole}
        canSwitchRole={canSwitchRole}
        open={roleSimOpen}
        onOpenChange={onRoleSimOpenChange}
      />

      {/* ── 3. Consultora ── */}
      {showConsultoraSection && (
        <div className="py-1 border-b border-border-subtle">
          <MenuGroupLabel>Consultora</MenuGroupLabel>
          {(canManageUsers(userRole, systemRole) || isSuperAdmin) && (
            <MenuLink href="/dashboard/usuarios" icon={Users} label="Usuarios" />
          )}
          {/* Finanzas: solo el admin main de la consultora (full_access_main),
              developer o super-admin. Espejo de canAccessFinanzas (lib/finanzas/access).
              full_access_branch NO ve este ítem. El gate por plan lo aplican las páginas. */}
          {(canManageUsers(userRole, systemRole) || isSuperAdmin) && (
            <MenuLink href="/dashboard/finanzas" icon={CreditCard} label="Finanzas" />
          )}
          {(canManageUsers(userRole, systemRole) || isSuperAdmin) && (
            <MenuLink href="/dashboard/finanzas/cotizaciones" icon={FileText} label="Presupuestos" />
          )}
          {(canManageUsers(userRole, systemRole) || isSuperAdmin) && (
            <MenuLink href="/dashboard/finanzas/contratos" icon={FileCheck} label="Contratos" />
          )}
          <MenuLink href="/dashboard/configuracion/api-keys" icon={KeyRound} label="API Keys" />
          {(userRole === 'full_access_main' || isSuperAdmin) && (
            <MenuLink href="/dashboard/papelera" icon={Trash2} label="Papelera de reciclaje" />
          )}
        </div>
      )}

      {/* ── 4. Herramientas (solo super-admin) ── */}
      {isSuperAdmin && (
        <div className="py-1 border-b border-border-subtle">
          <MenuGroupLabel>Herramientas</MenuGroupLabel>
          <MenuLink href="/dashboard/admin" icon={ShieldCheck} label={tNav('superAdmin')} />
          <MenuLink href="/dashboard/admin/feedback" icon={MessageSquare} label={tNav('feedbackAdmin')} />
          <MenuLink href="/dashboard/admin/regalar-plan" icon={Gift} label="Regalar plan" />
        </div>
      )}

      {/* ── 5. Perfil y ayuda ── */}
      <div className="py-1 border-t border-border-subtle">
        <MenuLink href="/dashboard/perfil" icon={User} label="Mi perfil" />
        <MenuLink href="/dashboard/configuracion/seguridad" icon={ShieldCheck} label="Seguridad" />
        <MenuLink href="/dashboard/tutoriales" icon={BookMarked} label="Tutoriales de Uso" />
        {!hideKeyboardShortcuts && (
          <MenuLink href="/dashboard/atajos" icon={Keyboard} label="Atajos de teclado" />
        )}
      </div>

      {/* ── 6. Idioma ── */}
      <div className="border-t border-border-subtle">
        <LanguageSwitcher />
      </div>

      {/* ── 7. Logout ── */}
      <div className="border-t border-border-subtle">
        <button
          onClick={onSignOut}
          role="menuitem"
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors rounded-b-xl focus-visible:outline-none focus-visible:bg-surface-sunken"
        >
          <LogOut size={16} strokeWidth={1.75} className="text-text-tertiary" aria-hidden="true" />
          {tNav('logout')}
        </button>
      </div>
    </>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function MenuGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
        {children}
      </p>
    </div>
  )
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>
  label: string
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors focus-visible:outline-none focus-visible:bg-surface-sunken"
    >
      <span className="text-text-tertiary shrink-0" aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      {label}
    </Link>
  )
}
