// Shared Recharts styling helpers
import React from 'react'

export const CHART_COLORS = ['#4CAF50', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

export const PROJECT_COLORS: Record<string, string> = {
  VINE: '#4CAF50',
  SHIL: '#3B82F6',
  GUAT: '#F59E0B',
}

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  },
  labelStyle: { color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' },
  itemStyle: { color: 'var(--text-primary)' },
}

export const AXIS_STYLE = {
  tick: { fill: 'var(--text-tertiary)', fontSize: 11 },
  axisLine: { stroke: 'transparent' },
  tickLine: { stroke: 'transparent' },
}

// Gradient defs for AreaChart fills — paste inside <AreaChart> or <ComposedChart>
export const GRADIENT_IDS = {
  green:  'grad-green',
  blue:   'grad-blue',
  amber:  'grad-amber',
  purple: 'grad-purple',
  red:    'grad-red',
}

export function GradientDefs() {
  return (
    <defs>
      {[
        { id: 'grad-green',  color: '#4CAF50' },
        { id: 'grad-blue',   color: '#3B82F6' },
        { id: 'grad-amber',  color: '#F59E0B' },
        { id: 'grad-purple', color: '#8B5CF6' },
        { id: 'grad-red',    color: '#EF4444' },
      ].map(({ id, color }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      ))}
    </defs>
  )
}
