'use client'

import { Badge } from '@/components/ui/badge'
import { useEntidadFirmada } from '@/lib/queries/firmas'
import type { FirmaEntidadTipo } from '@/lib/types'
import { FileSignature } from 'lucide-react'

interface FirmaBadgeProps {
  entidadTipo: FirmaEntidadTipo
  entidadId: string
  showLabel?: boolean
}

export function FirmaBadge({ entidadTipo, entidadId, showLabel = true }: FirmaBadgeProps) {
  const { data: firmada, isLoading } = useEntidadFirmada(entidadTipo, entidadId)

  if (isLoading) return null

  if (firmada) {
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <FileSignature size={12} />
        {showLabel ? 'Firmada' : ''}
      </Badge>
    )
  }

  return (
    <Badge variant="warning" className="flex items-center gap-1">
      {showLabel ? 'Pendiente de firma' : ''}
    </Badge>
  )
}
