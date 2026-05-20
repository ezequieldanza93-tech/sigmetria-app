import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '@/components/ui/card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies hover class when hover prop is true', () => {
    const { container } = render(<Card hover>Hover</Card>)
    expect(container.firstChild).toHaveClass('hover:shadow-[var(--shadow-md)]')
  })

  it('applies padding classes', () => {
    const { container } = render(<Card padding="lg">Padded</Card>)
    expect(container.firstChild).toHaveClass('p-8')
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="my-class">Custom</Card>)
    expect(container.firstChild).toHaveClass('my-class')
  })
})
