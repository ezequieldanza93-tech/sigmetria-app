'use client'

import { usePathname } from 'next/navigation'

export type NavigationLevel = 'consultora' | 'empresa' | 'establecimiento'

export interface NavigationLevelResult {
  level: NavigationLevel
  empresaId: string | null
  establecimientoId: string | null
}

/**
 * Determina el nivel de navegación actual basado en la ruta:
 * - consultora: /dashboard/* (sin empresa ni establecimiento)
 * - empresa: /dashboard/empresas/[id] (con empresa pero sin establecimiento)
 * - establecimiento: /dashboard/empresas/[id]/establecimientos/[estId]
 *
 * Ignora rutas especiales como "nueva" o "nuevo".
 */
export function useNavigationLevel(): NavigationLevelResult {
  const pathname = usePathname()

  const match = pathname.match(
    /^\/dashboard\/empresas\/([^/]+)(?:\/establecimientos\/([^/]+))?/,
  )

  if (!match) {
    return { level: 'consultora', empresaId: null, establecimientoId: null }
  }

  const rawEmpresa = match[1]
  const rawEst = match[2]

  // Skip non-id segments like /nueva, /nuevo
  const empresaId = rawEmpresa && rawEmpresa !== 'nueva' ? rawEmpresa : null
  if (!empresaId) {
    return { level: 'consultora', empresaId: null, establecimientoId: null }
  }

  const establecimientoId =
    rawEst && rawEst !== 'nuevo' ? rawEst : null

  if (establecimientoId) {
    return { level: 'establecimiento', empresaId, establecimientoId }
  }

  return { level: 'empresa', empresaId, establecimientoId: null }
}
