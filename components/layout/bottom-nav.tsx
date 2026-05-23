'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Bell, BarChart2, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard/empresas', icon: Building2, label: 'Empresas' },
  { href: '/dashboard/notificaciones', icon: Bell, label: 'Alertas' },
  { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/dashboard/configuracion/consultora', icon: User, label: 'Perfil' },
]

export function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard/empresas') {
      return pathname === '/dashboard/empresas' || pathname.startsWith('/dashboard/empresas/')
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-surface-base border-t border-border-subtle safe-area-pb"
    >
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px] rounded-lg transition-colors ${
                active
                  ? 'text-brand-primary'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2 : 1.5}
                aria-hidden="true"
              />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
