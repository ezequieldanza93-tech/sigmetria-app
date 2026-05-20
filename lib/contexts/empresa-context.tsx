'use client'

import { createContext, useContext } from 'react'

interface EmpresaContextValue {
  empresaId: string
  razonSocial: string
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null)

export function EmpresaProvider({ children, empresaId, razonSocial }: React.PropsWithChildren<EmpresaContextValue>) {
  return (
    <EmpresaContext.Provider value={{ empresaId, razonSocial }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa(): EmpresaContextValue {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa debe usarse dentro de un EmpresaProvider')
  return ctx
}
