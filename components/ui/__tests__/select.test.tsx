import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Select } from '@/components/ui/select'

describe('Select', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
  ]

  it('renders select with options', () => {
    render(<Select options={options} />)
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Select label="Tipo" options={options} />)
    expect(screen.getByText('Tipo')).toBeInTheDocument()
  })

  it('renders placeholder when provided', () => {
    render(<Select options={options} placeholder="Seleccioná..." />)
    expect(screen.getByText('Seleccioná...')).toBeInTheDocument()
  })

  it('renders error message', () => {
    render(<Select options={options} error="Campo requerido" />)
    expect(screen.getByText('Campo requerido')).toBeInTheDocument()
  })

  it('shows required indicator', () => {
    render(<Select label="Tipo" options={options} required />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})
