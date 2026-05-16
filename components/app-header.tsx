'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { canManageUsers, UserRole, SystemRole, ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface AppHeaderProps {
  fullName: string
  email: string
  consultoraNombre: string | null
  userRole: UserRole | null
  systemRole: SystemRole
}

function SigmetriaIsotipo() {
  return (
    <svg viewBox="0 0 24 26" height="28" aria-hidden="true">
      <polygon points="12,1 1,25 12,25" fill="#4CAF50" />
      <polygon points="12,1 23,25 12,25" fill="none" stroke="#888888" strokeWidth="1.5" />
    </svg>
  )
}

const NAV = [
  { label: 'Dashboard', href: '/dashboard', exact: true },
  { label: 'Empresas', href: '/dashboard/empresas', exact: false },
  { label: 'Organizaciones', href: '/dashboard/organizaciones', exact: false },
  { label: 'Productos', href: '/dashboard/productos', exact: false },
]

export function AppHeader({ fullName, email, consultoraNombre, userRole, systemRole }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isDeveloper = systemRole === 'developer'
  const isAdmin = canManageUsers(userRole, systemRole)

  const firstName = fullName.split(' ')[0] ?? fullName
  const displayRole = isDeveloper ? 'developer' : userRole
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

  const navItems = [
    ...NAV,
    ...(isAdmin ? [{ label: 'Usuarios', href: '/dashboard/usuarios', exact: false }] : []),
    ...(isDeveloper ? [{ label: 'Nueva Consultora', href: '/onboarding', exact: false }] : []),
  ]

  function isActive(item: { href: string; exact: boolean }) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')
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

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActive(item)
                  ? 'bg-green-50 text-green-700 font-medium'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
              style={{ fontFamily: 'Poppins, system-ui' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

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
            <div className="text-right hidden md:block">
              <p className="text-xs text-gray-400 uppercase tracking-wider" style={{ fontFamily: 'Poppins, system-ui' }}>
                Consultora
              </p>
              <p className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, system-ui' }}>
                {consultoraNombre}
              </p>
            </div>
          )}

          <div className="relative group">
            <button
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors"
              aria-label="Menú de usuario"
            >
              {initials || '?'}
            </button>

            {/* Dropdown */}
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
