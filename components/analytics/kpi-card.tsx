'use client'

import React, { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

// Count-up hook — ease-out cubic, 900ms
function useCountUp(target: number, enabled = true): number {
  const [count, setCount] = useState(0)
  const frameRef = useRef<number>(0)
  useEffect(() => {
    if (!enabled || typeof target !== 'number') { setCount(target); return }
    const start = performance.now()
    const duration = 900
    const from = 0
    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(from + eased * (target - from)))
      if (p < 1) frameRef.current = requestAnimationFrame(frame)
    }
    frameRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, enabled])
  return count
}

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  status?: 'success' | 'warning' | 'danger' | 'neutral'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  className?: string
  animate?: boolean
  pulse?: boolean        // show pulsing status dot
}

const STATUS = {
  success: { text: 'text-[#4CAF50]', bg: 'bg-[rgba(76,175,80,0.08)]', border: 'border-l-[#4CAF50]', dot: '#4CAF50' },
  warning: { text: 'text-[#F59E0B]', bg: 'bg-[rgba(245,158,11,0.08)]', border: 'border-l-[#F59E0B]', dot: '#F59E0B' },
  danger:  { text: 'text-[#EF4444]', bg: 'bg-[rgba(239,68,68,0.08)]',  border: 'border-l-[#EF4444]',  dot: '#EF4444' },
  neutral: { text: 'text-text-primary', bg: '', border: 'border-l-transparent', dot: '#6B7280' },
}

const SIZE = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-5xl' }

export function KpiCard({ title, value, subtitle, trend, trendValue, status = 'neutral', size = 'md', icon, className, animate = true, pulse = false }: KpiCardProps) {
  const isNum = typeof value === 'number'
  const animated = useCountUp(isNum ? value : 0, animate && isNum)
  const displayed = isNum ? animated : value
  const s = STATUS[status]
  const TIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const tColor = trend === 'up' ? 'text-[#4CAF50]' : trend === 'down' ? 'text-[#EF4444]' : 'text-text-tertiary'

  return (
    <div className={cn(
      'rounded-xl border border-border-subtle border-l-4 p-4 flex flex-col gap-1.5 transition-all duration-200 hover:shadow-[var(--shadow-md)]',
      s.bg, s.border, 'bg-surface-elevated',
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest leading-tight font-heading">
          {title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {pulse && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: s.dot }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: s.dot }} />
            </span>
          )}
          {icon && <span className="text-text-tertiary">{icon}</span>}
        </div>
      </div>

      <div className={cn('font-bold font-heading leading-none tabular-nums', SIZE[size], s.text)}>
        {displayed}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {subtitle && <span className="text-[11px] text-text-tertiary leading-tight">{subtitle}</span>}
          {trend && (
            <span className={cn('flex items-center gap-0.5 text-[11px] font-semibold', tColor)}>
              <TIcon size={11} strokeWidth={2.5} />
              {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
