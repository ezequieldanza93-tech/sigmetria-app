'use client'

import { PreviewProvider } from '@/lib/contexts/preview-context'
import { ChatWidget } from '@/components/agent/chat-widget'

interface SidebarWrapperProps {
  header: React.ReactNode
  children: React.ReactNode
}

export function SidebarWrapper({ header, children }: SidebarWrapperProps) {
  return (
    <PreviewProvider>
      <div className="flex min-h-screen flex-col bg-surface-base">
        {header}
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      </div>
      <ChatWidget />
    </PreviewProvider>
  )
}
