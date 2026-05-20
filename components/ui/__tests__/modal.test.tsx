import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Modal } from '@/components/ui/modal'

describe('Modal', () => {
  it('renders title when open', () => {
    render(<Modal open title="My Modal" onClose={() => {}}>Content</Modal>)
    expect(screen.getByText('My Modal')).toBeInTheDocument()
  })

  it('renders children when open', () => {
    render(<Modal open title="Test" onClose={() => {}}><div>Child Content</div></Modal>)
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  it('renders close button', () => {
    render(<Modal open title="Test" onClose={() => {}}>Content</Modal>)
    expect(screen.getByText('×')).toBeInTheDocument()
  })
})
