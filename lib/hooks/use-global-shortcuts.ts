'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useShortcuts } from '@/lib/contexts/shortcuts-context'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { SHORTCUT_KEY_MAP } from '@/lib/constants/shortcuts'
import { toast } from '@/lib/hooks/use-toast'

/** Returns true when running on a pointer-fine desktop (≥1024px) */
function isDesktop(): boolean {
  return (
    window.matchMedia('(pointer: fine)').matches &&
    window.innerWidth >= 1024
  )
}

/**
 * Returns true when the keyboard event target is an editable element.
 * We skip shortcuts when the user is typing in inputs, textareas,
 * contenteditable nodes, or any element marked [data-shortcut-ignore].
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  const tag = el.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  if (el.closest('[data-shortcut-ignore]')) return true
  return false
}

/** Builds a normalized combo string from a KeyboardEvent, e.g. "ctrl+shift+p" */
function normalizeCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey) parts.push('alt')
  const key = e.key.toLowerCase()
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key)
  return parts.join('+')
}

// ── Navigation history (module-level so it survives re-renders) ──────────────
// Max 5 entries in each direction
const navHistory: string[] = []
const navFuture: string[] = []
let isUndoRedoNav = false // flag to skip history push for undo/redo navigations

/**
 * Registers a global keydown listener on `window` for Ctrl+Shift+X shortcuts.
 * Only active on desktop (pointer: fine + min-width 1024px).
 * Must be called inside a component that is wrapped by ShortcutsProvider.
 */
export function useGlobalShortcuts() {
  const { emit } = useShortcuts()
  const router = useRouter()
  const pathname = usePathname()
  // En mobile no hay teclado: ni siquiera registramos el listener.
  const isMobile = useIsMobile()

  // Keep stable refs so the keydown listener never needs to be re-added
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const emitRef = useRef(emit)
  emitRef.current = emit
  const routerRef = useRef(router)
  routerRef.current = router

  // Track pathname changes for undo/redo
  useEffect(() => {
    if (isUndoRedoNav) {
      isUndoRedoNav = false
      return
    }
    navFuture.length = 0 // clear redo stack on regular navigation
    if (navHistory[navHistory.length - 1] !== pathname) {
      navHistory.push(pathname)
      if (navHistory.length > 5) navHistory.shift()
    }
  }, [pathname])

  // Register the single global keydown listener.
  // On mobile we never attach it (no keyboard → no shortcuts).
  // Re-runs if the viewport crosses the mobile breakpoint.
  useEffect(() => {
    if (isMobile) return

    function handleKeyDown(e: KeyboardEvent) {
      if (!isDesktop()) return
      if (isEditableTarget(e.target)) return

      const combo = normalizeCombo(e)
      const action = SHORTCUT_KEY_MAP[combo]
      if (!action) return

      e.preventDefault()
      e.stopPropagation()

      const currentPath = pathnameRef.current
      const router = routerRef.current

      // ── Navigation shortcuts ───────────────────────────────────────────────
      if (action === 'goto-dashboard') {
        router.push('/dashboard')
        return
      }

      if (action === 'goto-gestiones' || action === 'goto-seguimientos') {
        const match = currentPath.match(
          /\/dashboard\/empresas\/([^/?#]+)\/establecimientos\/([^/?#]+)/,
        )
        if (!match) {
          toast.info('Navegá a un establecimiento para usar este atajo')
          return
        }
        const section = action === 'goto-gestiones' ? 'agenda' : 'seguimiento'
        router.push(
          `/dashboard/empresas/${match[1]}/establecimientos/${match[2]}?section=${section}`,
        )
        return
      }

      // ── Undo / Redo ────────────────────────────────────────────────────────
      if (action === 'undo') {
        if (navHistory.length <= 1) {
          toast.info('No hay acciones anteriores para deshacer')
          return
        }
        const prev = navHistory[navHistory.length - 2]
        navFuture.unshift(currentPath)
        if (navFuture.length > 5) navFuture.pop()
        navHistory.pop()
        isUndoRedoNav = true
        router.push(prev)
        return
      }

      if (action === 'redo') {
        if (navFuture.length === 0) {
          toast.info('No hay acciones para rehacer')
          return
        }
        const next = navFuture.shift()!
        navHistory.push(currentPath)
        if (navHistory.length > 5) navHistory.shift()
        isUndoRedoNav = true
        router.push(next)
        return
      }

      // ── Component-local actions (emitted to registered handlers) ───────────
      emitRef.current(action)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
    // Only depends on isMobile: uses refs for all other mutable values
  }, [isMobile])
}
