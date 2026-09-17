/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfettiBurst } from '../confetti-burst'

afterEach(() => {
  vi.useRealTimers()
})

describe('confetti burst', () => {
  it('fires a decorative layer that cleans itself up', () => {
    vi.useFakeTimers()

    render(<ConfettiBurst seed={42} />)

    const layer = screen.getByTestId('checkin-confetti')
    expect(layer).toBeVisible()
    // 纯装饰：不拦鼠标、对读屏软件隐藏
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer.className).toContain('pointer-events-none')

    act(() => {
      vi.advanceTimersByTime(2600)
    })

    expect(screen.queryByTestId('checkin-confetti')).not.toBeInTheDocument()
  })

  it('lays out the same draw the same way', () => {
    const first = render(<ConfettiBurst seed={7} />)
    const firstMarkup = first.container.innerHTML
    first.unmount()

    const second = render(<ConfettiBurst seed={7} />)

    expect(second.container.innerHTML).toBe(firstMarkup)
  })

  it('mixes emoji pieces into the confetti', () => {
    const { container } = render(<ConfettiBurst seed={3} pieces={40} />)

    const pieces = container.querySelectorAll('.checkin-confetti')
    const emoji = container.querySelectorAll('.checkin-confetti-emoji')

    expect(pieces).toHaveLength(40)
    expect(emoji.length).toBeGreaterThan(0)
  })
})
