import React from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  className?: string
}

export const StatCard = React.memo(function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <div className={cn('bg-surface-elevated rounded-xl border border-border-subtle p-5', className)}>
      <p className="text-sm text-text-secondary font-medium">{label}</p>
      <p className="text-3xl font-bold text-text-primary mt-1">{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-1">{sub}</p>}
    </div>
  )
})
