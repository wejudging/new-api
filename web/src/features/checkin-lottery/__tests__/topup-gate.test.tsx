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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { CheckinLottery } from '../index'
import type { CheckinLotteryStatus } from '../types'

const { lottery } = vi.hoisted(() => ({
  lottery: { value: null as CheckinLotteryStatus | null },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({ to, children }: { to?: string; children?: React.ReactNode }) => (
    <a href={typeof to === 'string' ? to : undefined}>{children}</a>
  ),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: { checkin_enabled: true } }),
}))

vi.mock('../hooks/use-checkin-lottery', () => ({
  CHECKIN_LOTTERY_QUERY_KEY: ['checkin-lottery'],
  useCheckinLotteryStatus: () => ({
    data: { data: lottery.value },
    isPending: false,
  }),
}))

function status(
  overrides: Partial<CheckinLotteryStatus> = {}
): CheckinLotteryStatus {
  return {
    enabled: true,
    require_topup: true,
    topup_satisfied: true,
    daily_draws: 1,
    daily_tickets: 0,
    bonus_tickets: 0,
    topup_yuan_per_draw: 10,
    tickets: 0,
    checked_in_today: false,
    prizes: [
      { amount: 0.01, weight: 9000, probability: 0.9 },
      { amount: 0.5, weight: 1000, probability: 0.1 },
    ],
    expected_amount: 0.1,
    stats: { total_draws: 0, total_amount: 0, best_amount: 0 },
    rank: 0,
    leaderboard: [],
    leaderboard_count: 20,
    referral: {
      aff_code: 'abcd',
      invite_count: 0,
      rewarded_count: 0,
      tickets: 0,
      base_tickets: 1,
      step_yuan: 10,
      enabled: true,
    },
    ...overrides,
  }
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CheckinLottery />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  lottery.value = status()
  useAuthStore.getState().auth.setUser({
    id: 7,
    username: 'hohai',
    role: 1,
    quota: 120000,
  })
})

describe('top-up gate on the daily draw page', () => {
  it('holds accounts without a top-up at the door', () => {
    lottery.value = status({ topup_satisfied: false })

    renderPage()

    expect(screen.getByText('Top up to join the daily draw')).toBeVisible()
    expect(screen.getByRole('link', { name: /Top up now/ })).toHaveAttribute(
      'href',
      '/wallet'
    )
    expect(screen.queryByText('Prize pool')).not.toBeInTheDocument()
  })

  it('hands the draw back once the account has topped up', () => {
    renderPage()

    expect(
      screen.queryByText('Top up to join the daily draw')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Prize pool')).toBeVisible()
    expect(screen.getByRole('button', { name: /Check-in draw/ })).toBeEnabled()
  })

  it('leaves the draw open while the restriction is switched off', () => {
    lottery.value = status({ require_topup: false, topup_satisfied: false })

    renderPage()

    expect(
      screen.queryByText('Top up to join the daily draw')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Prize pool')).toBeVisible()
  })
})
