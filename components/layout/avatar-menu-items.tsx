'use client'

/**
 * AvatarMenuContent — contenido canónico del dropdown del avatar.
 * Fuente de verdad compartida entre AppHeader (desktop) y FloatingAvatar (mobile).
 *
 * Secciones:
 *  1. Info de usuario (nombre, email, consultora)
 *  2. RoleSwitcher
 *  3. Consultora — acceso completo a navegación de la consultora
 *  4. Herramientas (Super Admin, Feedback Admin) — solo isSuperAdmin
 *  5. Perfil y ayuda (Mi perfil, Seguridad, Tutoriales, Atajos)
 *  6. LanguageSwitcher
 *  7. Logout
 *
 * La navegación principal de la consultora (Consultora, Marketing) vive acá.
 * Herramientas (Catalogación, Vencimientos, etc.) sigue en la Ficha Global.
 */

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LogOut, ShieldCheck, MessageSquare, Keyboard, BookMarked, User, Users, Trash2, Gift, CreditCard, FileText, Building2, Gauge, Megaphone } from 'lucide-react'
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
  /** Gate para Marketing (contenido / CRM). */
  showMarketing?: boolean
  /** Gate para Reportes. False por defecto. */
  showReportes?: boolean
  /** Callback para cerrar el menú cuando se navega. */
  onMenuClose?: () => void
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
  showMarketing = false,
  showReportes = false,
  onMenuClose,
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
          <MenuLink onClose={onMenuClose} href="/dashboard/configuracion/consultora" icon={Building2} label="Información" />
          {(canManageUsers(userRole, systemRole) || isSuperAdmin) && (
            <MenuLink onClose={onMenuClose} href="/dashboard/usuarios" icon={Users} label="Equipo" />
          )}
          <MenuLink onClose={onMenuClose} href="/dashboard/instrumentos" icon={Gauge} label="Instrumentos" />
          {/* Finanzas: solo admin main (full_access_main), developer o super-admin.
              Espejo de canAccessFinanzas (lib/finanzas/access).
              full_access_branch NO ve este ítem. El gate por plan lo aplican las páginas. */}
          {(canManageUsers(userRole, systemRole) || isSuperAdmin) && (
            <MenuLink onClose={onMenuClose} href="/dashboard/finanzas" icon={CreditCard} label="Finanzas" />
          )}
          {showMarketing && (
            <MenuLink onClose={onMenuClose} href="/dashboard/contenido" icon={Megaphone} label="Marketing" />
          )}
          {/* Conexiones ahora está dentro de Configuración > Consultora */}
          {showReportes && (
            <MenuLink onClose={onMenuClose} href="/dashboard/reportes" icon={FileText} label="Reportes" />
          )}
          {(userRole === 'full_access_main' || isSuperAdmin) && (
            <MenuLink onClose={onMenuClose} href="/dashboard/papelera" icon={Trash2} label="Papelera de reciclaje" />
          )}
        </div>
      )}

      {/* ── 4. Herramientas (solo super-admin) ── */}
      {isSuperAdmin && (
        <div className="py-1 border-b border-border-subtle">
          <MenuGroupLabel>Herramientas</MenuGroupLabel>
          <MenuLink onClose={onMenuClose} href="/dashboard/admin" icon={ShieldCheck} label={tNav('superAdmin')} />
          <MenuLink onClose={onMenuClose} href="/dashboard/admin/feedback" icon={MessageSquare} label={tNav('feedbackAdmin')} />
          <MenuLink onClose={onMenuClose} href="/dashboard/admin/regalar-plan" icon={Gift} label="Regalar plan" />
        </div>
      )}

      {/* ── 5. Perfil y ayuda ── */}
      <div className="py-1 border-t border-border-subtle">
        <MenuLink onClose={onMenuClose} href="/dashboard/perfil" icon={User} label="Mi perfil" />
        <MenuLink onClose={onMenuClose} href="/dashboard/configuracion/seguridad" icon={ShieldCheck} label="Seguridad" />
        <MenuLink onClose={onMenuClose} href="/dashboard/tutoriales" icon={BookMarked} label="Tutoriales de Uso" />
        {!hideKeyboardShortcuts && (
          <MenuLink onClose={onMenuClose} href="/dashboard/atajos" icon={Keyboard} label="Atajos de teclado" />
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
  onClose,
}: {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>
  label: string
  onClose?: () => void
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClose}
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors focus-visible:outline-none focus-visible:bg-surface-sunken"
    >
      <span className="text-text-tertiary shrink-0" aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      {label}
    </Link>
  )
}
