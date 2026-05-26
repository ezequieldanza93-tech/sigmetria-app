'use client'

import { ShortcutsProvider } from '@/lib/contexts/shortcuts-context'
import { ChatWidget } from '@/components/agent/chat-widget'
import { useGlobalShortcuts } from '@/lib/hooks/use-global-shortcuts'

interface SidebarWrapperProps {
  header: React.ReactNode
  children: React.ReactNode
}

/** Mounts the global keyboard listener inside ShortcutsProvider. Renders nothing. */
function GlobalShortcutsHandler() {
  useGlobalShortcuts()
  return null
}

export function SidebarWrapper({ header, children }: SidebarWrapperProps) {
  return (
    <ShortcutsProvider>
      <GlobalShortcutsHandler />
      <div className="flex min-h-screen flex-col bg-surface-base">
        {header}
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      </div>
      <ChatWidget />
    </ShortcutsProvider>
  )
}
