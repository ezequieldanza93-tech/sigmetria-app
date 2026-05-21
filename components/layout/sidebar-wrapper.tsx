'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { MobileMenuProvider } from './mobile-menu-context'
import { PreviewProvider } from '@/lib/contexts/preview-context'
import { ChatWidget } from '@/components/agent/chat-widget'

interface SidebarWrapperProps {
  header: React.ReactNode
  children: React.ReactNode
  isSuperAdmin?: boolean
}

export function SidebarWrapper({ header, children, isSuperAdmin }: SidebarWrapperProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sigmetria.sidebar.collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-current-width',
      collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
    )
  }, [collapsed])

  return (
    <MobileMenuProvider onOpen={() => setMobileOpen(true)}>
    <PreviewProvider>
      <div className="flex min-h-screen bg-surface-base">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onCollapsedChange={setCollapsed}
          isSuperAdmin={isSuperAdmin}
        />

        <div className="flex-1 flex flex-col min-w-0 sidebar-content-area">
          {header}
          <main className="flex-1">{children}</main>
        </div>
      </div>

      <ChatWidget />
    </PreviewProvider>
    </MobileMenuProvider>
  )
}
