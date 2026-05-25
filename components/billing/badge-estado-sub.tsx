'use client'

import { Badge } from '@/components/ui/badge'


const ESTADO_LABELS: Record<string, string> = {
  active: 'Activa',
  trialing: 'Prueba',
  past_due: 'Vencida',
  pending: 'Pendiente',
  canceled: 'Cancelada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
}

const ESTADO_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  pending: 'default',
  canceled: 'danger',
  expired: 'default',
  cancelled: 'danger',
}

interface BadgeEstadoSubProps {
  estado: string
}

export function BadgeEstadoSub({ estado }: BadgeEstadoSubProps) {
  const label = ESTADO_LABELS[estado] ?? estado
  const variant = ESTADO_VARIANTS[estado] ?? 'default'

  return <Badge variant={variant}>{label}</Badge>
}
