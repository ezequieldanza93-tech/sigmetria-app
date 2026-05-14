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
}

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: '▣', roles: 'all' as const },
  { label: 'Empresas', href: '/dashboard/empresas', icon: '🏢', roles: 'all' as const },
  { label: 'Usuarios', href: '/dashboard/usuarios', icon: '👥', roles: 'admin' as const },
]

export function Sidebar({ fullName, email, userRole, systemRole }: SidebarProps) {
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

  return (
    <aside className="w-60 bg-slate-900 min-h-screen flex flex-col border-r border-slate-800">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Sigmetría</p>
            <p className="text-slate-500 text-xs">HyS Platform</p>
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
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="mb-3">
          <p className="text-white text-sm font-medium truncate">{fullName}</p>
          <p className="text-slate-500 text-xs truncate">{email}</p>
          {displayRole && (
            <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
              {roleLabel}
            </span>
          )}
        </div>
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
