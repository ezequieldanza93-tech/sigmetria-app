import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    const btn = screen.getByText('Delete')
    expect(btn.className).toContain('bg-[var(--danger)]')
  })

  it('applies size classes', () => {
    render(<Button size="lg">Big</Button>)
    const btn = screen.getByText('Big')
    expect(btn.className).toContain('px-5')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Button ref={ref}>Ref</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('handles disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    const btn = screen.getByText('Disabled') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    const btn = screen.getByText('Custom')
    expect(btn.className).toContain('custom-class')
  })
})
