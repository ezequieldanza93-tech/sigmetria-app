'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SystemRole, UserRole, ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

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

function SigmetriaIsotipo() {
  return (
    <svg viewBox="0 0 24 26" height="28" aria-hidden="true">
      <polygon points="12,1 1,25 12,25" fill="#4CAF50" />
      <polygon points="12,1 23,25 12,25" fill="none" stroke="#888888" strokeWidth="1.5" />
    </svg>
  )
}

export function AppHeader({ fullName, email, consultoraNombre, userRole, systemRole }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [crumbs, setCrumbs] = useState<Crumb[]>([])

  useEffect(() => {
    const match = pathname.match(ROUTE_PATTERN)
    if (!match) {
      setCrumbs([])
      return
    }

    const empresaId = match[1]
    const estId = match[2]

    async function buildCrumbs() {
      const items: Crumb[] = [{ label: 'Empresas', href: '/dashboard/empresas' }]

      if (!empresaId || empresaId === 'nueva') {
        setCrumbs(items)
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
        return
      }

      const { data: est } = await supabase
        .from('establecimientos')
        .select('nombre')
        .eq('id', estId)
        .single()

      if (est) {
        items.push({ label: est.nombre })
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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="flex items-center h-16 px-6 gap-4">

        {/* Left: Sigmetría brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
          <SigmetriaIsotipo />
          <div className="leading-tight">
            <span className="text-sm font-bold text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, system-ui' }}>
              SIGMETRÍA
            </span>
            <span className="text-xs text-gray-400 block" style={{ fontFamily: 'Poppins, system-ui' }}>
              HyS Platform
            </span>
          </div>
        </Link>

        {/* Breadcrumb */}
        {crumbs.length > 0 && (
          <nav className="hidden md:flex items-center gap-1.5 text-sm ml-4" aria-label="Breadcrumb">
            {crumbs.map((crumb, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-300 select-none">›</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                    style={{ fontFamily: 'Poppins, system-ui' }}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className="text-gray-700 font-medium"
                    style={{ fontFamily: 'Poppins, system-ui' }}
                  >
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        )}

        {/* Center: user name */}
        <div className="flex-1 flex justify-center">
          <div className="text-center hidden sm:block">
            <p className="text-sm font-semibold text-gray-800" style={{ fontFamily: 'Montserrat, system-ui' }}>
              {firstName}
            </p>
            {displayRole && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        {/* Right: consultora + user menu */}
        <div className="flex items-center gap-3 shrink-0">
          {consultoraNombre && (
            <div className="relative group hidden md:block">
              <button className="text-right cursor-pointer">
                <p className="text-xs text-gray-400 uppercase tracking-wider" style={{ fontFamily: 'Poppins, system-ui' }}>
                  Consultora
                </p>
                <p className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, system-ui' }}>
                  {consultoraNombre}
                </p>
              </button>
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo Consultora</p>
                </div>
                <Link
                  href="/dashboard/equipo"
                  className="block px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Ver Equipo
                </Link>
                <Link
                  href="/dashboard/instrumentos"
                  className="block px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors rounded-b-xl"
                >
                  Instrumentos Habilitados
                </Link>
              </div>
            </div>
          )}

          <div className="relative group">
            <button
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors"
              aria-label="Menú de usuario"
            >
              {initials || '?'}
            </button>

            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
                <p className="text-xs text-gray-400 truncate">{email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors rounded-b-xl"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
