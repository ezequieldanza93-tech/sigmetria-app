import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    const { container } = render(<Badge variant="success">Success</Badge>)
    expect(container.firstChild).toHaveClass('bg-[var(--success-bg)]')
  })

  it('defaults to default variant', () => {
    const { container } = render(<Badge>Default</Badge>)
    expect(container.firstChild).toHaveClass('bg-surface-elevated')
  })

  it('applies custom className', () => {
    const { container } = render(<Badge className="my-badge">Styled</Badge>)
    expect(container.firstChild).toHaveClass('my-badge')
  })
})
