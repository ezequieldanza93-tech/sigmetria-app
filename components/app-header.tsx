'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Sun, Moon, Users, UserCog, Network, Gauge, Shield, Settings2, LogOut } from 'lucide-react'
import { SystemRole, UserRole, ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useMobileMenu } from '@/components/layout/mobile-menu-context'
import { WeatherClock } from '@/components/weather-clock'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  fullName: string
  email: string
  consultoraNombre: string | null
  userRole: UserRole | null
  systemRole: SystemRole
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
}: AppHeaderProps) {
  const { openMobileMenu } = useMobileMenu()
  const pathname = usePathname()
  const router = useRouter()
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [contextAddress, setContextAddress] = useState<string | null>(null)
  const [tipoLabel, setTipoLabel] = useState<string | null>(null)
  const [forecastCoords, setForecastCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isDark, setIsDark] = useState(false)

  const isHome = pathname === '/dashboard' || pathname === '/dashboard/empresas'

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

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
      setForecastCoords(null)
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
        setForecastCoords(null)
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
        setForecastCoords(null)
        return
      }

      const { data: est } = await supabase
        .from('establecimientos')
        .select('nombre, domicilio, codigo_postal, localidades!localidad_id(nombre, provincia), establecimientos_tipos(id, codigo, nombre), latitude, longitude')
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
        const lat = est.latitude as number | null
        const lng = est.longitude as number | null
        setForecastCoords(lat != null && lng != null ? { lat, lng } : null)
      } else {
        setContextAddress(null)
        setTipoLabel(null)
        setForecastCoords(null)
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

        {/* Mobile hamburger */}
        <button
          onClick={openMobileMenu}
          className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors shrink-0"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>

        {/* Mobile logo */}
        <Link href="/dashboard" className="lg:hidden flex items-center gap-2 shrink-0">
          <svg viewBox="0 0 24 26" height="24" aria-hidden="true">
            <polygon points="12,1 1,25 12,25" fill="#4CAF50" />
            <polygon
              points="12,1 23,25 12,25"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="1.5"
            />
          </svg>
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
              {tipoLabel && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-brand-muted text-brand-primary ml-0.5">
                  {tipoLabel}
                </span>
              )}
            </nav>
            {contextAddress && (
              <p
                className="text-xs text-text-tertiary mt-0.5"
                style={{ fontFamily: 'Poppins, system-ui' }}
              >
                {contextAddress}
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

        {/* Right: weather + consultora + dark mode + avatar */}
        <div className="flex items-center gap-3 shrink-0">

          <WeatherClock
            forecastLat={forecastCoords?.lat}
            forecastLng={forecastCoords?.lng}
          />

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
          <div className="relative group">
            <button
              className="w-8 h-8 bg-surface-elevated rounded-full flex items-center justify-center text-xs font-bold text-text-secondary hover:bg-brand-muted hover:text-brand-primary transition-colors"
              aria-label="Menú de usuario"
            >
              {initials || '?'}
            </button>

            <div className="absolute right-0 top-full mt-2 w-52 bg-surface-elevated border border-border-subtle rounded-xl shadow-[var(--shadow-lg)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="px-4 py-3 border-b border-border-subtle">
                <p className="text-sm font-medium text-text-primary truncate">{fullName}</p>
                <p className="text-xs text-text-tertiary truncate">{email}</p>
              </div>

              {/* Admin items */}
              <div className="py-1 border-b border-border-subtle">
                <DropdownItem href="/dashboard/personas" icon={Users} label="Personas" />
                <DropdownItem href="/dashboard/usuarios" icon={UserCog} label="Usuarios" />
                <DropdownItem href="/dashboard/organizaciones-externas" icon={Network} label="Organizaciones" />
                <DropdownItem href="/dashboard/instrumentos" icon={Gauge} label="Instrumentos" />
                <DropdownItem href="/dashboard/productos" icon={Shield} label="Productos" />
                <DropdownItem href="/dashboard/configuracion/catalogacion" icon={Settings2} label="Catalogación" />
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors rounded-b-xl"
              >
                <LogOut size={16} strokeWidth={1.75} className="text-text-tertiary" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function DropdownItem({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
    >
      <span className="text-text-tertiary">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      {label}
    </Link>
  )
}
