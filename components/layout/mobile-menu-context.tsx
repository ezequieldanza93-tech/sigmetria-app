'use client'

import { createContext, useContext } from 'react'

interface MobileMenuContextValue {
  openMobileMenu: () => void
}

const MobileMenuContext = createContext<MobileMenuContextValue>({
  openMobileMenu: () => {},
})

export function useMobileMenu() {
  return useContext(MobileMenuContext)
}

export function MobileMenuProvider({
  children,
  onOpen,
}: {
  children: React.ReactNode
  onOpen: () => void
}) {
  return (
    <MobileMenuContext.Provider value={{ openMobileMenu: onOpen }}>
      {children}
    </MobileMenuContext.Provider>
  )
}
