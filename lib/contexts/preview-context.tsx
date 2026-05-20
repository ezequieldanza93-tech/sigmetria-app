'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface PreviewContextValue {
  isOpen: boolean
  setIsOpen: (v: boolean) => void
}

const PreviewContext = createContext<PreviewContextValue | null>(null)

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <PreviewContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </PreviewContext.Provider>
  )
}

export function usePreview() {
  const ctx = useContext(PreviewContext)
  if (!ctx) throw new Error('usePreview must be inside PreviewProvider')
  return ctx
}
