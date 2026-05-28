'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sun, Moon, Users, UserCog, Network, Gauge, Shield, Settings2, LogOut, Building2, BarChart2, CreditCard, ShieldCheck, CalendarClock, AlertTriangle, Scale, Map, ClipboardList, MessageSquare, Wifi, WifiOff, Download, GraduationCap, BookOpen, Keyboard, Home, BookMarked, FileCheck, KeyRound } from 'lucide-react'
import { SystemRole, UserRole, ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
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
}: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [contextAddress, setContextAddress] = useState<string | null>(null)
  const [tipoLabel, setTipoLabel] = useState<string | null>(null)
  const { isOnline } = useNetworkStatus()
  const { install, isInstalled, canInstall } = useInstallPrompt()
  const [isDark, setIsDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

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
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
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

  const firstName = fullName.split(' ')[0] ?? fullName
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

        {/* Center: user name + role */}
        <div className="flex-1 flex justify-center">
          <div className="text-center hidden sm:block">
            <p
              className="text-sm font-semibold text-text-primary"
              style={{ fontFamily: 'Montserrat, system-ui' }}
            >
              {firstName}
            </p>
            {displayRole && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        {/* Right: notifications + weather + network + install + consultora + dark mode + avatar */}
        <div className="flex items-center gap-3 shrink-0">

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

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
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

                {/* Consultora */}
                <div className="py-1 border-b border-border-subtle">
                  <div className="px-4 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Consultora</p>
                  </div>
                  <DropdownItem href="/dashboard/configuracion/consultora" icon={Building2} label="Información" role="menuitem" />
                  <DropdownItem href="/dashboard/instrumentos" icon={Gauge} label="Instrumentos" role="menuitem" />
                  <DropdownItem href="/dashboard/usuarios" icon={UserCog} label="Usuarios" role="menuitem" />
                  <DropdownItem href="/dashboard/billing" icon={CreditCard} label="Suscripción" role="menuitem" />
                  {(userRole === 'full_access_main' || isSuperAdmin) && (
                    <DropdownItem href="/dashboard/configuracion/api-keys" icon={KeyRound} label="API Keys" role="menuitem" />
                  )}
                </div>

                {/* Directorio */}
                <div className="py-1 border-b border-border-subtle">
                  <div className="px-4 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Directorio</p>
                  </div>
                  <DropdownItem href="/dashboard/personas" icon={Users} label="Personas" role="menuitem" />
                  <DropdownItem href="/dashboard/organizaciones-externas" icon={Network} label="Organizaciones" role="menuitem" />
                  <DropdownItem href="/dashboard/productos" icon={Shield} label="Productos" role="menuitem" />
                </div>

                {/* Incidentes y Denuncias */}
                <div className="py-1 border-b border-border-subtle">
                  <div className="px-4 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Incidentes y Denuncias</p>
                  </div>
                  <DropdownItem href="/dashboard/incidentes" icon={AlertTriangle} label="Incidentes" role="menuitem" />
                  <DropdownItem href="/dashboard/denuncias" icon={Scale} label="Denuncias" role="menuitem" />
                </div>

                {/* Capacitación */}
                <div className="py-1 border-b border-border-subtle">
                  <div className="px-4 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Capacitación</p>
                  </div>
                  <DropdownItem href="/dashboard/cursos" icon={GraduationCap} label="Mis Cursos" role="menuitem" />
                  {(userRole === 'full_access_main' || userRole === 'full_access_branch' || isSuperAdmin) && (
                    <>
                      <DropdownItem href="/dashboard/cursos/admin" icon={BookOpen} label="Administrar Cursos" role="menuitem" />
                      <DropdownItem href="/dashboard/cursos/compliance" icon={BarChart2} label="Compliance" role="menuitem" />
                    </>
                  )}
                </div>

                {/* Cumplimiento */}
                {(userRole === 'full_access_main' || userRole === 'responsable_estandares' || isSuperAdmin) && (
                  <div className="py-1 border-b border-border-subtle">
                    <div className="px-4 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Cumplimiento</p>
                    </div>
                    <DropdownItem href="/dashboard/reportes" icon={FileCheck} label="Reportes" role="menuitem" />
                  </div>
                )}

                {/* Herramientas */}
                <div className="py-1 border-b border-border-subtle">
                  <div className="px-4 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Herramientas</p>
                  </div>
                  <DropdownItem href="/dashboard/analytics" icon={BarChart2} label="Analytics" role="menuitem" />
                  <DropdownItem href="/dashboard/configuracion/catalogacion" icon={Settings2} label="Catalogación" role="menuitem" />
                  <DropdownItem href="/dashboard/configuracion/vencimientos" icon={CalendarClock} label="Vencimientos" role="menuitem" />
                  <DropdownItem href="/dashboard/configuracion/iperc" icon={ClipboardList} label="Librería IPERC" role="menuitem" />
                  <DropdownItem href="/dashboard/configuracion/feedback" icon={MessageSquare} label="Feedback" role="menuitem" />
                  <DropdownItem href="/dashboard/mapas" icon={Map} label="Mapa de Riesgos" role="menuitem" />
                  {isSuperAdmin && (
                    <>
                      <DropdownItem href="/dashboard/admin" icon={ShieldCheck} label="Super Admin" role="menuitem" />
                      <DropdownItem href="/dashboard/admin/feedback" icon={MessageSquare} label="Feedback Admin" role="menuitem" />
                    </>
                  )}
                </div>

                {/* Ayuda */}
                <div className="py-1 border-t border-border-subtle">
                  <DropdownItem href="/dashboard/tutoriales" icon={BookMarked} label="Tutoriales de Uso" role="menuitem" />
                  <DropdownItem href="/dashboard/atajos" icon={Keyboard} label="Atajos de teclado" role="menuitem" />
                </div>

                <button
                  onClick={handleLogout}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors rounded-b-xl focus-visible:outline-none focus-visible:bg-surface-sunken"
                >
                  <LogOut size={16} strokeWidth={1.75} className="text-text-tertiary" aria-hidden="true" />
                  Cerrar sesión
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
