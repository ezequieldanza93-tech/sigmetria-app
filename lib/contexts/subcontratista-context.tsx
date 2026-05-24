'use client'

import { createContext, useContext } from 'react'

interface SubcontratistaContextValue {
  subcontratistaId: string
  nombre: string
}

const SubcontratistaContext = createContext<SubcontratistaContextValue | null>(null)

export function SubcontratistaProvider({
  children,
  subcontratistaId,
  nombre,
}: React.PropsWithChildren<SubcontratistaContextValue>) {
  return (
    <SubcontratistaContext.Provider value={{ subcontratistaId, nombre }}>
      {children}
    </SubcontratistaContext.Provider>
  )
}

export function useSubcontratistaContext(): SubcontratistaContextValue {
  const ctx = useContext(SubcontratistaContext)
  if (!ctx) throw new Error('useSubcontratistaContext debe usarse dentro de un SubcontratistaProvider')
  return ctx
}
