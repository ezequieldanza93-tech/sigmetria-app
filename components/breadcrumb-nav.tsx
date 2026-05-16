'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Crumb {
  label: string
  href?: string
}

const ROUTE_PATTERN = /\/dashboard\/empresas(?:\/([^/]+)(?:\/establecimientos(?:\/([^/]+))?)?)?/

export function BreadcrumbNav() {
  const pathname = usePathname()
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
      const items: Crumb[] = [
        { label: 'Empresas', href: '/dashboard/empresas' },
      ]

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
        items.push({ label: est.nombre, href: undefined })
      }

      setCrumbs(items)
    }

    buildCrumbs()
  }, [pathname])

  if (!crumbs.length) return null

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-2">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
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
    </div>
  )
}
