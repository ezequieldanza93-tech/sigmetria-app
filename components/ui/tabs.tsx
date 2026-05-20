'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  content: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)

  const current = tabs.find(t => t.id === active)

  return (
    <div className={className}>
      <div className="border-b border-border-subtle mb-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2',
                tab.id === active
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-default',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div>{current?.content}</div>
    </div>
  )
}
