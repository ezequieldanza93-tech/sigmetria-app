'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { MobileMenuProvider } from './mobile-menu-context'

interface SidebarWrapperProps {
  header: React.ReactNode
  children: React.ReactNode
}

export function SidebarWrapper({ header, children }: SidebarWrapperProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sigmetria.sidebar.collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  // Update CSS var so .sidebar-content-area picks up the right offset
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-current-width',
      collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
    )
  }, [collapsed])

  return (
    <MobileMenuProvider onOpen={() => setMobileOpen(true)}>
      <div className="flex min-h-screen bg-surface-base">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onCollapsedChange={setCollapsed}
        />

        {/*
          On mobile: sidebar is an off-canvas drawer — no padding needed.
          On desktop (lg+): .sidebar-content-area adds padding-left = --sidebar-current-width
        */}
        <div className="flex-1 flex flex-col min-w-0 sidebar-content-area">
          {header}
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </MobileMenuProvider>
  )
}
