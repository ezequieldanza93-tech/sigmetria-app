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
    <div className={cn('bg-white rounded-xl border border-gray-200 p-5', className)}>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
})
