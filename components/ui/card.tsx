import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, className, hover = false, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-elevated border border-border-subtle rounded-xl',
        paddingClasses[padding],
        hover && 'hover:shadow-[var(--shadow-md)] transition-shadow cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}
