'use client'

import { usePathname } from 'next/navigation'
import { ConsultoraShell } from '@/components/consultora/consultora-shell'

interface Props {
  children: React.ReactNode
}

// Rutas con ID de empresa (y sus subrutas) tienen shell propio.
function ownsItsSidebar(pathname: string): boolean {
  return pathname.startsWith('/dashboard/empresas/')
}

export function GlobalSectionsSidebar({ children }: Props) {
  const pathname = usePathname() ?? ''

  if (ownsItsSidebar(pathname)) {
    return <>{children}</>
  }

  return <ConsultoraShell>{children}</ConsultoraShell>
}
