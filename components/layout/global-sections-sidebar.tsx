'use client'

import { usePathname } from 'next/navigation'
import { ConsultoraShell } from '@/components/consultora/consultora-shell'

interface Props {
  empresas: { id: string; razon_social: string }[]
  children: React.ReactNode
}

// Rutas que YA montan su propio sidebar (EmpresaShell / EstablecimientoShell)
// o el ConsultoraShell directamente — no deben recibir el sidebar global
// para evitar duplicados. Todo lo demás bajo /dashboard sí lo recibe.
function ownsItsSidebar(pathname: string): boolean {
  // Solo las rutas con ID de empresa (y sus subrutas) tienen shell propio.
  // /dashboard/empresas (lista) usa el ConsultoraShell del layout.
  return pathname.startsWith('/dashboard/empresas/')
}

export function GlobalSectionsSidebar({ empresas, children }: Props) {
  const pathname = usePathname() ?? ''

  if (ownsItsSidebar(pathname)) {
    return <>{children}</>
  }

  return <ConsultoraShell empresas={empresas}>{children}</ConsultoraShell>
}
