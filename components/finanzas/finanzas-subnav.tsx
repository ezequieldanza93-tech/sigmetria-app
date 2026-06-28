'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  FileSignature,
  ListChecks,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard/finanzas', label: 'Panel ejecutivo', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/finanzas/cotizaciones', label: 'Presupuestos', icon: ClipboardList },
  { href: '/dashboard/finanzas/facturacion', label: 'Facturación', icon: Receipt },
  { href: '/dashboard/finanzas/contratos', label: 'Contratos', icon: FileSignature },
  { href: '/dashboard/finanzas/gastos', label: 'Gastos', icon: ListChecks },
  { href: '/dashboard/finanzas/configuracion', label: 'Configuración', icon: Settings2 },
]

export function FinanzasSubnav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-border-subtle mb-6">
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
              active
                ? 'border-sig-600 text-sig-600 bg-sig-50/50'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-subtle',
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
