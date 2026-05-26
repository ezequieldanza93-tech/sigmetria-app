'use client'

import { useState } from 'react'
import { SeccionesSidebar } from './secciones-sidebar'

interface Props {
  empresaId: string
  establecimientoId: string
  children: React.ReactNode
}

export function EstablecimientoShell({ empresaId, establecimientoId, children }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <SeccionesSidebar
        empresaId={empresaId}
        establecimientoId={establecimientoId}
        expanded={expanded}
        onToggle={() => setExpanded(v => !v)}
      />
      <div
        className={`transition-[padding] duration-200 ${
          expanded ? 'lg:pl-40' : 'lg:pl-14'
        }`}
      >
        {children}
      </div>
    </>
  )
}
