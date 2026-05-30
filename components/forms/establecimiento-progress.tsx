'use client'

import { ArrowRight, Check } from 'lucide-react'

export interface ProgressCheck {
  id: string
  label: string
  done: boolean
}

interface Props {
  checks: ProgressCheck[]
}

function levelFromPercent(pct: number): { label: string; color: string; ring: string; track: string } {
  if (pct >= 100) return { label: 'Completo', color: 'text-success', ring: 'stroke-success', track: 'stroke-success/15' }
  if (pct >= 90)  return { label: 'Casi completo', color: 'text-sig-700', ring: 'stroke-sig-700', track: 'stroke-sig-700/15' }
  if (pct >= 60)  return { label: 'Casi listo',   color: 'text-sig-500', ring: 'stroke-sig-500', track: 'stroke-sig-500/15' }
  if (pct >= 30)  return { label: 'Identificado', color: 'text-sig-400', ring: 'stroke-sig-400', track: 'stroke-sig-400/15' }
  return            { label: 'En construcción', color: 'text-text-tertiary', ring: 'stroke-text-tertiary', track: 'stroke-text-tertiary/15' }
}

export function EstablecimientoProgress({ checks }: Props) {
  const done = checks.filter(c => c.done).length
  const total = checks.length || 1
  const pct = Math.round((done / total) * 100)
  const next = checks.find(c => !c.done)
  const level = levelFromPercent(pct)

  // SVG ring math
  const size = 56
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div
      className="sticky top-0 z-20 -mx-6 sm:-mx-8 px-6 sm:px-8 py-3 mb-4
                 bg-surface-base/85 backdrop-blur-md border-b border-border-subtle"
    >
      <div className="flex items-center gap-4">
        {/* Ring with percent */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={stroke}
              fill="none"
              className={level.track}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={`${level.ring} transition-[stroke-dashoffset] duration-500 ease-out`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {pct >= 100 ? (
              <Check className="text-success" size={20} strokeWidth={2.5} />
            ) : (
              <span className={`text-sm font-bold tabular-nums ${level.color}`}>{pct}%</span>
            )}
          </div>
        </div>

        {/* Level + next action */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold uppercase tracking-wider ${level.color}`}>
              {level.label}
            </span>
            <span className="text-xs text-text-tertiary">·</span>
            <span className="text-xs text-text-tertiary tabular-nums">
              {done}/{total} campos
            </span>
          </div>
          {next ? (
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-text-primary truncate">
              <ArrowRight size={13} className="text-sig-500 shrink-0" />
              <span className="text-text-tertiary">Próximo paso:</span>
              <span className="font-medium truncate">{next.label}</span>
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-success font-medium">
              Establecimiento completo. Toda la información está cargada.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
