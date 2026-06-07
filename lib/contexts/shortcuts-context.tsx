'use client'

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react'
import type { ShortcutAction } from '@/lib/constants/shortcuts'

type Handler = () => void
type Unsubscribe = () => void

interface ShortcutsContextValue {
  /** Fire an action — all registered handlers for that action will be called */
  emit: (action: ShortcutAction) => void
  /** Register a handler. Returns a cleanup function to unregister. */
  subscribe: (action: ShortcutAction, handler: Handler) => Unsubscribe
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null)

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<Map<ShortcutAction, Set<Handler>>>(new Map())

  const emit = useCallback((action: ShortcutAction) => {
    handlersRef.current.get(action)?.forEach(h => h())
  }, [])

  const subscribe = useCallback((action: ShortcutAction, handler: Handler): Unsubscribe => {
    const map = handlersRef.current
    if (!map.has(action)) map.set(action, new Set())
    map.get(action)!.add(handler)
    return () => map.get(action)?.delete(handler)
  }, [])

  return (
    <ShortcutsContext.Provider value={{ emit, subscribe }}>
      {children}
    </ShortcutsContext.Provider>
  )
}

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext)
  if (!ctx) throw new Error('useShortcuts must be used inside ShortcutsProvider')
  return ctx
}

/**
 * Register a handler for a specific shortcut action.
 * The handler ref is kept up-to-date on every render without re-registering.
 * Components auto-unregister on unmount.
 */
export function useShortcutAction(action: ShortcutAction, handler: () => void) {
  const { subscribe } = useShortcuts()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    return subscribe(action, () => handlerRef.current())
    // subscribe is stable (useCallback with no deps), action rarely changes
  }, [action, subscribe])
}
