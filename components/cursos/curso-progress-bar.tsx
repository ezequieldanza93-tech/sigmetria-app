'use client'

interface CursoProgressBarProps {
  value: number
  className?: string
}

export function CursoProgressBar({ value, className = '' }: CursoProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={`w-full h-2 bg-surface-sunken rounded-full overflow-hidden ${className}`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          clamped >= 100 ? 'bg-green-500' : clamped >= 50 ? 'bg-brand-primary' : 'bg-amber-500'
        }`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
