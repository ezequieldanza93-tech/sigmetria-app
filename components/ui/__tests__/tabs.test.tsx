import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tabs } from '@/components/ui/tabs'

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Tab A', content: <div>Content A</div> },
    { id: 'b', label: 'Tab B', content: <div>Content B</div> },
  ]

  it('renders tab buttons', () => {
    render(<Tabs tabs={tabs} />)
    expect(screen.getByText('Tab A')).toBeInTheDocument()
    expect(screen.getByText('Tab B')).toBeInTheDocument()
  })

  it('renders first tab content by default', () => {
    render(<Tabs tabs={tabs} />)
    expect(screen.getByText('Content A')).toBeInTheDocument()
  })

  it('respects defaultTab', () => {
    render(<Tabs tabs={tabs} defaultTab="b" />)
    expect(screen.getByText('Content B')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Tabs tabs={tabs} className="my-class" />)
    expect(container.firstChild).toHaveClass('my-class')
  })
})
