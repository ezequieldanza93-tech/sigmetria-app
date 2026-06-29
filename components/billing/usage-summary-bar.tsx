'use client'

import { Building2, BarChart3, Users } from 'lucide-react'

interface UsageItem {
  usado: number
  limite: number | null
}

interface UsageSummaryBarProps {
  empresas: UsageItem
  establecimientos: UsageItem
  colaboradores: UsageItem
}

function getChipClasses(usado: number, limite: number | null): string {
  if (limite === null) {
    return 'bg-surface-sunken text-text-secondary'
  }
  const pct = limite > 0 ? (usado / limite) * 100 : 0
  if (pct >= 95) return 'bg-danger-bg text-danger'
  if (pct >= 80) return 'bg-warning-bg text-warning'
  return 'bg-surface-sunken text-text-secondary'
}

function UsageChip({
  icon: Icon,
  label,
  usado,
  limite,
}: {
  icon: React.FC<{ size?: number; className?: string }>
  label: string
  usado: number
  limite: number | null
}) {
  const chipCls = getChipClasses(usado, limite)
  const display = limite !== null ? `${usado}/${limite}` : `${usado}`

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${chipCls}`}>
      <Icon size={11} />
      <span>
        {display} {label}
      </span>
    </span>
  )
}

export function UsageSummaryBar({ empresas, establecimientos, colaboradores }: UsageSummaryBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 border-b border-border-subtle bg-surface-base">
      <UsageChip
        icon={Building2}
        label={empresas.usado === 1 ? 'empresa' : 'empresas'}
        usado={empresas.usado}
        limite={empresas.limite}
      />
      <UsageChip
        icon={BarChart3}
        label={establecimientos.usado === 1 ? 'establecimiento' : 'establecimientos'}
        usado={establecimientos.usado}
        limite={establecimientos.limite}
      />
      <UsageChip
        icon={Users}
        label={colaboradores.usado === 1 ? 'colaborador' : 'colaboradores'}
        usado={colaboradores.usado}
        limite={colaboradores.limite}
      />
    </div>
  )
}
