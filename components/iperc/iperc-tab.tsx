'use client'

import { IpercMatrizWizard } from './matriz-wizard'

interface Props {
  establecimientoId: string
  canWrite: boolean
}

export function IpercTab({ establecimientoId, canWrite }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Matriz IPERC</h2>
      </div>
      <p className="text-sm text-text-secondary">
        Gestión de Identificación de Peligros, Evaluación de Riesgos y Control organizada por sectores.
      </p>
      <IpercMatrizWizard establecimientoId={establecimientoId} canWrite={canWrite} />
    </div>
  )
}
