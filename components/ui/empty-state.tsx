import { Building2, Search, FileText, Users, AlertCircle, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

type EmptyStateVariant = 'empresas' | 'search' | 'documents' | 'users' | 'generic'

interface EmptyStateProps {
  variant?: EmptyStateVariant
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

const ICONS: Record<EmptyStateVariant, LucideIcon> = {
  empresas: Building2,
  search: Search,
  documents: FileText,
  users: Users,
  generic: AlertCircle,
}

export function EmptyState({ variant = 'generic', title, description, action }: EmptyStateProps) {
  const Icon = ICONS[variant]

  return (
    <div className="bg-surface-base rounded-xl border border-border-subtle p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-sunken mb-4">
        <Icon className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
      </div>
      <h3 className="text-text-primary font-medium text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-text-secondary text-sm max-w-md mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-hover text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-hover text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
