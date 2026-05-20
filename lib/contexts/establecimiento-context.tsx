'use client'

import { createContext, useContext } from 'react'

interface EstablecimientoContextValue {
  establecimientoId: string
  nombre: string
  empresaId: string
}

const EstablecimientoContext = createContext<EstablecimientoContextValue | null>(null)

export function EstablecimientoProvider({ children, establecimientoId, nombre, empresaId }: React.PropsWithChildren<EstablecimientoContextValue>) {
  return (
    <EstablecimientoContext.Provider value={{ establecimientoId, nombre, empresaId }}>
      {children}
    </EstablecimientoContext.Provider>
  )
}

export function useEstablecimiento(): EstablecimientoContextValue {
  const ctx = useContext(EstablecimientoContext)
  if (!ctx) throw new Error('useEstablecimiento debe usarse dentro de un EstablecimientoProvider')
  return ctx
}
