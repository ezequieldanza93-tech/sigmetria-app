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
        <main className="flex-1">{children}</main>
      </div>
      <ChatWidget />
    </PreviewProvider>
  )
}
