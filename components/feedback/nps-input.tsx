'use client'

import { cn } from '@/lib/utils'

interface NpsInputProps {
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
}

const SCORE_COLORS: Record<string, string> = {
  detractor: 'bg-danger hover:bg-danger focus:ring-red-400',
  pasivo: 'bg-amber-400 hover:bg-amber-500 focus:ring-amber-300',
  promotor: 'bg-success hover:bg-success focus:ring-green-400',
}

function getScoreColor(score: number): string {
  if (score >= 9) return SCORE_COLORS.promotor
  if (score >= 7) return SCORE_COLORS.pasivo
  return SCORE_COLORS.detractor
}

function getScoreBgClass(score: number): string {
  if (score >= 9) return 'bg-success-bg dark:bg-green-950/20 border-green-200 dark:border-green-800'
  if (score >= 7) return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
  return 'bg-danger-bg dark:bg-red-950/20 border-red-200 dark:border-red-800'
}

export function NpsInput({ value, onChange, disabled }: NpsInputProps) {
  const scores = Array.from({ length: 11 }, (_, i) => i)

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs text-text-tertiary px-1">
        <span>Nada probable</span>
        <span>Muy probable</span>
      </div>
      <div className="flex gap-1.5 justify-center flex-wrap">
        {scores.map((score) => {
          const isSelected = value === score
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onClick={() => onChange(score)}
              className={cn(
                'w-9 h-9 sm:w-10 sm:h-10 rounded-full text-sm font-bold transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'focus-visible:ring-offset-surface-base',
                isSelected
                  ? `${getScoreColor(score)} text-white scale-110 shadow-md`
                  : 'bg-surface-base border border-border-default text-text-secondary hover:border-brand-primary hover:text-brand-primary',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              aria-label={`${score}`}
              aria-pressed={isSelected}
            >
              {score}
            </button>
          )
        })}
      </div>
      {/* Label de categoría */}
      {value !== null && (
        <div
          className={cn(
            'text-center text-sm font-medium py-2 px-3 rounded-lg border',
            getScoreBgClass(value),
          )}
        >
          {value >= 9 && '🌟 ¡Excelente! Nos alegra que te guste Sigmetría.'}
          {value >= 7 && value <= 8 && '👍 Nos ayuda saber que estás conforme. ¿Algo para mejorar?'}
          {value >= 4 && value <= 6 && '😐 Gracias por tu honestidad. Decinos qué podemos mejorar.'}
          {value <= 3 && '😔 Lamentamos que no estés satisfecho. Ayudanos a mejorar.'}
        </div>
      )}
    </div>
  )
}
