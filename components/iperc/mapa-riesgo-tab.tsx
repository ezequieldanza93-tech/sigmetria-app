'use client'

import { RiesgoMapaInterno } from './riesgo-mapa-interno'

interface Props {
  establecimientoId: string
  canWrite: boolean
  planoUrl: string | null
}

export function MapaRiesgoTab({ establecimientoId, canWrite, planoUrl }: Props) {
  return (
    <RiesgoMapaInterno
      establecimientoId={establecimientoId}
      planoUrl={planoUrl}
      canWrite={canWrite}
    />
  )
}
