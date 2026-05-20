'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
  badge?: { label: string; color?: 'green' | 'amber' | 'red' | 'blue' | 'neutral' }
}

const BADGE_COLORS = {
  green:   'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]',
  amber:   'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]',
  red:     'bg-[rgba(239,68,68,0.12)] text-[#EF4444]',
  blue:    'bg-[rgba(59,130,246,0.12)] text-[#3B82F6]',
  neutral: 'bg-surface-sunken text-text-secondary',
}

export function ChartCard({ title, subtitle, children, className, action, badge }: ChartCardProps) {
  return (
    <div className={cn('rounded-xl border border-border-subtle bg-surface-elevated overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border-subtle">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-text-primary font-heading truncate">{title}</h3>
            {badge && (
              <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', BADGE_COLORS[badge.color ?? 'neutral'])}>
                {badge.label}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
