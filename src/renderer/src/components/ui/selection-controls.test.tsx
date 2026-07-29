import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Checkbox } from './checkbox'
import { RadioGroup, RadioGroupItem } from './radio-group'

describe('selection controls', () => {
  it('applies visible checked-state styles to radio items', () => {
    render(
      <RadioGroup defaultValue="selected">
        <RadioGroupItem value="selected" aria-label="Selected option" />
      </RadioGroup>
    )

    const radio = screen.getByRole('radio', { name: 'Selected option' })
    expect(radio).toHaveAttribute('data-state', 'checked')
    expect(radio.className).toContain('data-[state=checked]:bg-primary')
  })

  it('applies visible checked-state styles to checkboxes', () => {
    render(<Checkbox checked aria-label="Selected checkbox" />)

    const checkbox = screen.getByRole('checkbox', { name: 'Selected checkbox' })
    expect(checkbox).toHaveAttribute('data-state', 'checked')
    expect(checkbox.className).toContain('data-[state=checked]:bg-primary')
  })
})
