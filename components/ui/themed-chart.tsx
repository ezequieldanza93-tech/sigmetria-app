'use client'

import { useEffect, useState } from 'react'

export interface ChartTheme {
  colors: string[]
  gridColor: string
  axisColor: string
  textColor: string
  tooltipBg: string
  tooltipBorder: string
}

const DEFAULT_THEME: ChartTheme = {
  colors: ['#4CAF50', '#2563EB', '#F59E0B', '#DC2626', '#A855F7', '#14B8A6'],
  gridColor: '#E4E4E7',
  axisColor: '#6B6B6B',
  textColor: '#333333',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E4E4E7',
}

function readTheme(): ChartTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const cs = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => {
    const v = cs.getPropertyValue(name).trim()
    return v || fallback
  }
  return {
    colors: [
      read('--chart-1', DEFAULT_THEME.colors[0]),
      read('--chart-2', DEFAULT_THEME.colors[1]),
      read('--chart-3', DEFAULT_THEME.colors[2]),
      read('--chart-4', DEFAULT_THEME.colors[3]),
      read('--chart-5', DEFAULT_THEME.colors[4]),
      read('--chart-6', DEFAULT_THEME.colors[5]),
    ],
    gridColor: read('--chart-grid', DEFAULT_THEME.gridColor),
    axisColor: read('--chart-axis', DEFAULT_THEME.axisColor),
    textColor: read('--text-primary', DEFAULT_THEME.textColor),
    tooltipBg: read('--bg-elevated', DEFAULT_THEME.tooltipBg),
    tooltipBorder: read('--border-default', DEFAULT_THEME.tooltipBorder),
  }
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(DEFAULT_THEME)

  useEffect(() => {
    setTheme(readTheme())
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}

export function useChartColors(count = 6): string[] {
  const { colors } = useChartTheme()
  return colors.slice(0, count)
}
