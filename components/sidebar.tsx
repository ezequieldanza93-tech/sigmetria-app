'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserRole, SystemRole, ROLE_LABELS, ROLE_COLORS, canManageUsers } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  fullName: string
  email: string
  userRole: UserRole | null
  systemRole: SystemRole
  consultoraNombre?: string | null
}

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: '▣', roles: 'all' as const },
  { label: 'Empresas', href: '/dashboard/empresas', icon: '🏢', roles: 'all' as const },
  { label: 'Usuarios', href: '/dashboard/usuarios', icon: '👥', roles: 'admin' as const },
]

export function Sidebar({ fullName, email, userRole, systemRole, consultoraNombre }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isDeveloper = systemRole === 'developer'
  const isAdmin = canManageUsers(userRole, systemRole)

  const displayRole = isDeveloper ? 'developer' : userRole
  const roleLabel = displayRole ? ROLE_LABELS[displayRole] : ''
  const roleColor = displayRole ? ROLE_COLORS[displayRole as keyof typeof ROLE_COLORS] : ''

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const filteredNav = NAV.filter(item => {
    if (item.roles === 'all') return true
    if (item.roles === 'admin') return isAdmin
    return false
  })

  const initials = fullName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <aside className="w-60 bg-slate-900 min-h-screen flex flex-col border-r border-slate-800">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-tight truncate">Sigmetría</p>
            <p className="text-slate-500 text-xs truncate">
              {consultoraNombre ?? 'HyS Platform'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {filteredNav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}

        {isDeveloper && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-slate-600 text-xs font-medium px-3 mb-2 uppercase tracking-wider">Developer</p>
            <Link
              href="/onboarding"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith('/onboarding')
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-base shrink-0">⚙️</span>
              <span>Nueva Consultora</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
            <span className="text-slate-300 text-xs font-bold">{initials || '?'}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">{fullName}</p>
            <p className="text-slate-500 text-xs truncate">{email}</p>
          </div>
        </div>
        {displayRole && (
          <span className={`inline-block mb-3 text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
            {roleLabel}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="w-full text-left text-slate-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
