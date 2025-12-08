import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function TestButton(props: { label: string }) {
  return <button>{props.label}</button>
}

describe('React + RTL smoke', () => {
  it('renders button', () => {
    render(<TestButton label="Click me" />)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })
})
