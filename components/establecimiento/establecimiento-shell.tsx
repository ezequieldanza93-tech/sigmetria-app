'use client'

import { useState } from 'react'
import { SeccionesSidebar } from './secciones-sidebar'

interface Props {
  empresaId: string
  establecimientoId: string
  bottomNav: React.ReactNode
  children: React.ReactNode
}

export function EstablecimientoShell({ empresaId, establecimientoId, bottomNav, children }: Props) {
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
        className={`transition-[padding] duration-200 pb-[calc(env(safe-area-inset-bottom,0px)+64px)] lg:pb-0 ${
          expanded ? 'lg:pl-40' : 'lg:pl-14'
        }`}
      >
        {children}
      </div>
      {bottomNav}
    </>
  )
}
