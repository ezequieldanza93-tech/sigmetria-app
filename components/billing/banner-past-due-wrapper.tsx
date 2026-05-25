'use client'

import { BannerPastDue } from './banner-past-due'

interface BannerPastDueWrapperProps {
  graceUntil: string | null
}

/**
 * Wrapper cliente para el BannerPastDue (necesario porque el layout es server component).
 * Este wrapper solo renderiza el banner — toda la lógica está en el layout.
 */
export function BannerPastDueWrapper({ graceUntil }: BannerPastDueWrapperProps) {
  // El banner se muestra sin botón de actualizar desde el layout (es estático)
  return <BannerPastDue graceUntil={graceUntil} />
}
