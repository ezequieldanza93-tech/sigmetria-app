'use client'

import { useState, useEffect } from 'react'
import { SectionsSidebar, type SectionItem } from './sections-sidebar'

const SIDEBAR_WIDTH_KEY = 'sidebar_expanded_width'
const DEFAULT_WIDTH = 160
const MIN_WIDTH = 80
const MAX_WIDTH = 240

interface Props {
  items: SectionItem[]
  activeId: string | null
  ariaLabel: string
  children: React.ReactNode
}

export function SectionsShell({ items, activeId, ariaLabel, children }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [expandedWidth, setExpandedWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY)
      if (stored) {
        const w = parseInt(stored)
        if (w >= MIN_WIDTH && w <= MAX_WIDTH) setExpandedWidth(w)
      }
    } catch {}
  }, [])

  function handleWidthChange(w: number) {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))
    setExpandedWidth(clamped)
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped)) } catch {}
  }

  const contentStyle: React.CSSProperties = {
    paddingLeft: expanded ? expandedWidth : undefined,
    transition: isResizing ? 'none' : undefined,
  }

  return (
    <>
      <SectionsSidebar
        items={items}
        activeId={activeId}
        expanded={expanded}
        expandedWidth={expandedWidth}
        onToggle={() => setExpanded(v => !v)}
        onWidthChange={handleWidthChange}
        onResizingChange={setIsResizing}
        ariaLabel={ariaLabel}
      />
      <div
        className={`transition-[padding] duration-200 ${!expanded ? 'lg:pl-14' : ''}`}
        style={contentStyle}
      >
        {children}
      </div>
    </>
  )
}
