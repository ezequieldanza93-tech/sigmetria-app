'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sun, Moon, LogOut, ShieldCheck, MessageSquare, Wifi, WifiOff, Download, Keyboard, Home, BookMarked, KeyRound, User, Users, Trash2 } from 'lucide-react'
import { SystemRole, UserRole, ROLE_LABELS, ROLE_COLORS, canManageUsers } from '@/lib/types'
import { RoleSwitcher } from '@/components/layout/role-switcher'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { useTranslations } from 'next-intl'
import { type SwitchableRole } from '@/lib/actions/change-role'
import { createClient } from '@/lib/supabase/client'
import { NotificationDropdown } from '@/components/notification-dropdown'
import { AlertasBell } from '@/components/alertas/alertas-bell'
import { useNetworkStatus } from '@/lib/hooks/use-network-status'
import { useInstallPrompt } from '@/components/install-pwa'
import { useShortcutAction } from '@/lib/contexts/shortcuts-context'
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip'

interface AppHeaderProps {
  fullName: string
  email: string
  consultoraNombre: string | null
  userRole: UserRole | null
  systemRole: SystemRole
  isSuperAdmin?: boolean
  simulatedRole?: SwitchableRole | null
  canSwitchRole?: boolean
}

interface Crumb {
  label: string
  href?: string
}

const ROUTE_PATTERN = /\/dashboard\/empresas(?:\/([^/]+)(?:\/establecimientos(?:\/([^/]+))?)?)?/

export function AppHeader({
  fullName,
  email,
  consultoraNombre,
  userRole,
  systemRole,
  isSuperAdmin = false,
  simulatedRole = null,
  canSwitchRole = false,
}: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const tNav = useTranslations('nav')
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [contextAddress, setContextAddress] = useState<string | null>(null)
  const [tipoLabel, setTipoLabel] = useState<string | null>(null)
  const { isOnline } = useNetworkStatus()
  const { install, isInstalled, canInstall } = useInstallPrompt()
  const [menuOpen, setMenuOpen] = useState(false)
  const [roleSimOpen, setRoleSimOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Ctrl+Shift+A → open avatar menu
  useShortcutAction('open-avatar-menu', () => setMenuOpen(true))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme')
    const next = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('sigmetria.theme', next)
  }

  useEffect(() => {
    const match = pathname.match(ROUTE_PATTERN)
    if (!match) {
      setCrumbs([])
      setContextAddress(null)
      setTipoLabel(null)
      return
    }

    const empresaId = match[1]
    const estId = match[2]

    async function buildCrumbs() {
      const items: Crumb[] = [{ label: 'Empresas', href: '/dashboard/empresas' }]

      if (!empresaId || empresaId === 'nueva') {
        setCrumbs(items)
        setContextAddress(null)
        setTipoLabel(null)
        return
      }

      const supabase = createClient()
      const { data: empresa } = await supabase
        .from('empresas')
        .select('razon_social')
        .eq('id', empresaId)
        .single()

      if (empresa) {
        items.push({
          label: empresa.razon_social,
          href: estId ? `/dashboard/empresas/${empresaId}` : undefined,
        })
      }

      if (!estId || estId === 'nuevo') {
        setCrumbs(items)
        setContextAddress(null)
        setTipoLabel(null)
        return
      }

      const { data: est } = await supabase
        .from('establecimientos')
        .select('nombre, domicilio, codigo_postal, localidades!localidad_id(nombre, provincia), establecimientos_tipos(id, codigo, nombre)')
        .eq('id', estId)
        .single()

      if (est) {
        items.push({ label: est.nombre })
        const parts: string[] = []
        if (est.domicilio) parts.push(est.domicilio)
        const locs = est.localidades as { nombre: string; provincia: string }[] | null
        const loc = locs?.[0]
        if (loc) parts.push(`${loc.nombre}, ${loc.provincia}`)
        setContextAddress(parts.length ? parts.join(' · ') : null)

        setTipoLabel(
          (est.establecimientos_tipos as { nombre: string }[] | null)?.[0]?.nombre ?? null
        )
      } else {
        setContextAddress(null)
        setTipoLabel(null)
      }

      setCrumbs(items)
    }

    buildCrumbs()
  }, [pathname])

  const displayRole = systemRole === 'developer' ? 'developer' : userRole
  const roleColor = displayRole ? (ROLE_COLORS as Record<string, string>)[displayRole] ?? '' : ''
  const roleLabel = displayRole ? (ROLE_LABELS as Record<string, string>)[displayRole] ?? '' : ''

  const initials = fullName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-base">
      <div className="flex items-center h-14 px-4 gap-3">

        {/* Brand: isotipo + wordmark — links home */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 shrink-0 group"
          aria-label="Inicio"
          title="Inicio"
        >
          <svg viewBox="0 0 24 26" height="24" aria-hidden="true">
            <polygon points="12,1 1,25 12,25" fill="#4CAF50" />
            <polygon
              points="12,1 23,25 12,25"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="1.5"
            />
          </svg>
          <span
            className="hidden sm:inline text-sm font-semibold text-text-primary group-hover:text-brand-primary transition-colors"
            style={{ fontFamily: 'Montserrat, system-ui' }}
          >
            SIGMETRÍA <span className="text-text-tertiary font-normal">HyS</span>
          </span>
          <Home
            size={15}
            strokeWidth={1.75}
            className="hidden sm:inline text-text-tertiary group-hover:text-brand-primary transition-colors"
            aria-hidden="true"
          />
        </Link>

        {/* Breadcrumb + address */}
        {crumbs.length > 0 && (
          <div className="hidden md:flex flex-col justify-center">
            <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
              {crumbs.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-text-tertiary select-none">›</span>
                  )}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-text-tertiary hover:text-text-secondary transition-colors"
                      style={{ fontFamily: 'Poppins, system-ui' }}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className="text-text-primary font-medium"
                      style={{ fontFamily: 'Poppins, system-ui' }}
                    >
                      {crumb.label}
                    </span>
                  )}
                </div>
              ))}
            </nav>
            {contextAddress && (
              <p
                className="text-xs text-text-tertiary mt-0.5"
                style={{ fontFamily: 'Poppins, system-ui' }}
              >
                {contextAddress}{tipoLabel ? ` — ${tipoLabel}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Center: user name + role — centrado absoluto respecto a toda la fila */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block text-center pointer-events-none select-none">
          <p
            className="text-sm font-semibold text-text-primary truncate max-w-[200px]"
            style={{ fontFamily: 'Montserrat, system-ui' }}
          >
            {fullName}
          </p>
          {displayRole && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
              {roleLabel}
            </span>
          )}
        </div>
        {/* Spacer para mantener el layout flex equilibrado */}
        <div className="flex-1" />

        {/* Right: notifications + weather + network + install + consultora + dark mode + avatar */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">

          {/* Network status icon */}
          <span
            className="inline-flex items-center justify-center"
            title={isOnline ? 'Conectado' : 'Sin conexión'}
            aria-label={isOnline ? 'Conectado' : 'Sin conexión'}
          >
            {isOnline ? (
              <Wifi size={16} className="text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
            ) : (
              <WifiOff size={16} className="text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
            )}
          </span>

          {/* Install PWA button */}
          {canInstall && !isInstalled && (
            <button
              onClick={install}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              aria-label="Instalar aplicación"
              title="Instalar aplicación"
            >
              <Download size={14} strokeWidth={2} />
              <span className="hidden sm:inline">Instalar app</span>
            </button>
          )}

          {/* Alertas SRT bell */}
          <AlertasBell />

          {/* Notification bell with dropdown */}
          <NotificationDropdown />

          {consultoraNombre && (
            <div className="hidden md:block text-right">
              <p
                className="text-xs text-text-tertiary uppercase tracking-wider"
                style={{ fontFamily: 'Poppins, system-ui' }}
              >
                Consultora
              </p>
              <p
                className="text-sm font-semibold text-text-secondary"
                style={{ fontFamily: 'Montserrat, system-ui' }}
              >
                {consultoraNombre}
              </p>
            </div>
          )}

          {/* Dark mode toggle — CSS-only icon swap to avoid hydration mismatch */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            aria-label="Cambiar tema"
            title="Cambiar tema"
          >
            <Sun size={18} strokeWidth={1.75} className="hidden dark:inline-block" />
            <Moon size={18} strokeWidth={1.75} className="inline-block dark:hidden" />
          </button>

          {/* Avatar + admin menu dropdown */}
          <div className="relative" ref={menuRef}>
            <ShortcutTooltip action="open-avatar-menu" side="bottom">
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls="user-menu"
                className="w-8 h-8 bg-surface-elevated rounded-full flex items-center justify-center text-xs font-bold text-text-secondary hover:bg-brand-muted hover:text-brand-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                aria-label="Menú de usuario"
              >
                {initials || '?'}
              </button>
            </ShortcutTooltip>

            {menuOpen && (
              <div 
                id="user-menu"
                role="menu"
                aria-label="Menú de usuario"
                className="absolute right-0 top-full mt-2 w-56 bg-surface-elevated border border-border-subtle rounded-xl shadow-[var(--shadow-lg)] z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-border-subtle">
                  <p className="text-sm font-medium text-text-primary truncate">{fullName}</p>
                  <p className="text-xs text-text-tertiary truncate">{email}</p>
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

                {/* Consultora */}
                {(userRole === 'full_access_main' || canManageUsers(userRole, systemRole) || isSuperAdmin) && (
                  <div className="py-1 border-b border-border-subtle">
                    <div className="px-4 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Consultora</p>
                    </div>
                    {(canManageUsers(userRole, systemRole) || isSuperAdmin) && (
                      <DropdownItem href="/dashboard/usuarios" icon={Users} label="Usuarios" role="menuitem" />
                    )}
                    <DropdownItem href="/dashboard/configuracion/api-keys" icon={KeyRound} label="API Keys" role="menuitem" />
                    {(userRole === 'full_access_main' || isSuperAdmin) && (
                      <DropdownItem href="/dashboard/papelera" icon={Trash2} label="Papelera de reciclaje" role="menuitem" />
                    )}
                  </div>
                )}

                {/* Directorio y Librerías viven en la Ficha Global de consultora
                    (components/consultora-ficha-global.tsx). NO se duplican acá. */}

                {/* Herramientas */}
                {isSuperAdmin && (
                  <div className="py-1 border-b border-border-subtle">
                    <div className="px-4 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Herramientas</p>
                    </div>
                    <DropdownItem href="/dashboard/admin" icon={ShieldCheck} label="Super Admin" role="menuitem" />
                    <DropdownItem href="/dashboard/admin/feedback" icon={MessageSquare} label="Feedback Admin" role="menuitem" />
                  </div>
                )}

                {/* Perfil y ayuda */}
                <div className="py-1 border-t border-border-subtle">
                  <DropdownItem href="/dashboard/perfil" icon={User} label="Mi perfil" role="menuitem" />
                  <DropdownItem href="/dashboard/configuracion/seguridad" icon={ShieldCheck} label="Seguridad" role="menuitem" />
                  <DropdownItem href="/dashboard/tutoriales" icon={BookMarked} label="Tutoriales de Uso" role="menuitem" />
                  <DropdownItem href="/dashboard/atajos" icon={Keyboard} label="Atajos de teclado" role="menuitem" />
                </div>

                <div className="border-t border-border-subtle">
                  <LanguageSwitcher />
                </div>

                <button
                  onClick={handleLogout}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors rounded-b-xl focus-visible:outline-none focus-visible:bg-surface-sunken"
                >
                  <LogOut size={16} strokeWidth={1.75} className="text-text-tertiary" aria-hidden="true" />
                  {tNav('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function DropdownItem({ href, icon: Icon, label, role }: { href: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>; label: string; role?: string }) {
  return (
    <Link
      href={href}
      role={role}
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors focus-visible:outline-none focus-visible:bg-surface-sunken"
    >
      <span className="text-text-tertiary" aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      {label}
    </Link>
  )
}
