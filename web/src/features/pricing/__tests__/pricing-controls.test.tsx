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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  ModelSuccessCell,
  ModelTpsCell,
  ModelTtftCell,
} from '../components/model-status-cell'
import {
  PricingToolbar,
  type PricingToolbarProps,
} from '../components/pricing-toolbar'

function toolbarProps(): PricingToolbarProps {
  return {
    filteredCount: 2,
    totalCount: 2,
    sortBy: 'name',
    onSortChange: vi.fn(),
  }
}

/**
 * The status cells read the shared performance query, so they need a client
 * even when the test passes the window explicitly.
 */
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function statusSlots(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-status-slot]'))
}

describe('pricing controls', () => {
  it('selects price sorting from the shared dropdown', async () => {
    const props = toolbarProps()
    const user = userEvent.setup()
    render(<PricingToolbar {...props} />)
    await user.click(screen.getByRole('button', { name: 'Name' }))
    await user.click(
      screen.getByRole('menuitem', { name: 'Price: Low to High' })
    )
    expect(props.onSortChange).toHaveBeenCalledWith('price-low')
  })

  it('does not expose a card/table view switch anymore', () => {
    render(<PricingToolbar {...toolbarProps()} />)
    expect(screen.queryByRole('button', { name: 'Card view' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Table view' })).toBeNull()
  })
})

describe('model status cell', () => {
  const windowStart = 1_700_000_000

  it('draws one tile per hour and grades each hour separately', () => {
    const series = Array.from({ length: 24 }, (_, hour) => ({
      ts: windowStart + hour * 3600,
      success_rate: hour === 0 ? 50 : 100,
    }))

    renderWithClient(
      <ModelSuccessCell
        perf={{
          success_rate: 99.5,
          avg_latency_ms: 1200,
          avg_tps: 40,
          recent_success_series: series,
          window_start: windowStart,
        }}
      />
    )

    const slots = statusSlots()
    expect(slots).toHaveLength(24)
    expect(slots[0].className).toContain('bg-red-500')
    expect(slots[1].className).toContain('bg-emerald-500')
    expect(screen.getByText('99.50%')).toBeVisible()
  })

  it('keeps missing hours gray and shows a dash without a window', () => {
    renderWithClient(<ModelSuccessCell perf={undefined} />)

    const slots = statusSlots()
    expect(slots).toHaveLength(24)
    expect(
      slots.every((slot) => slot.className.includes('bg-muted-foreground/15'))
    ).toBe(true)
    expect(screen.getByText('—')).toBeVisible()
  })

  it('renders TPS and first-token latency as their own columns', () => {
    renderWithClient(
      <>
        <ModelTpsCell
          perf={{
            success_rate: 99.5,
            avg_latency_ms: 1200,
            avg_ttft_ms: 2038,
            avg_tps: 220.53,
          }}
        />
        <ModelTtftCell
          perf={{
            success_rate: 99.5,
            avg_latency_ms: 1200,
            avg_ttft_ms: 2038,
            avg_tps: 220.53,
          }}
        />
      </>
    )

    expect(screen.getByText('220.5t/s')).toBeVisible()
    expect(screen.getByText('2.04s')).toBeVisible()
  })
})
