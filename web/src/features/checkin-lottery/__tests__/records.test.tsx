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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zhCN from '@/i18n/locales/zh.json'

import { CheckinLotteryRecords } from '../records'
import type {
  CheckinLotteryDrawRecord,
  CheckinLotteryTicketRecord,
} from '../types'

const { navigate, status, records } = vi.hoisted(() => ({
  navigate: vi.fn(),
  status: { value: { checkin_enabled: true } as Record<string, unknown> },
  records: {
    draw: { items: [] as unknown[], total: 0, loading: false },
    ticket: { items: [] as unknown[], total: 0, loading: false },
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
  Link: ({ to, children }: { to?: string; children?: React.ReactNode }) => (
    <a href={typeof to === 'string' ? to : undefined}>{children}</a>
  ),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: status.value }),
}))

vi.mock('../hooks/use-checkin-lottery-records', () => ({
  useCheckinLotteryDrawRecords: () => records.draw,
  useCheckinLotteryTicketRecords: () => records.ticket,
}))

const drawItems: CheckinLotteryDrawRecord[] = [
  { id: 1, user_id: 7, amount: 0.5, quota: 250000, created_at: 1750000000 },
  { id: 2, user_id: 7, amount: 0.05, quota: 25000, created_at: 1749900000 },
]

const ticketItems: CheckinLotteryTicketRecord[] = [
  { id: 1, user_id: 7, delta: 1, reason: 'claim', created_at: 1750000000 },
  { id: 2, user_id: 7, delta: -1, reason: 'draw', created_at: 1750000000 },
  { id: 3, user_id: 7, delta: 1, reason: 'refund', created_at: 1750000000 },
  { id: 4, user_id: 7, delta: 1, reason: 'topup', created_at: 1750000000 },
  { id: 5, user_id: 7, delta: 1, reason: 'referral', created_at: 1750000000 },
]

beforeEach(() => {
  navigate.mockReset()
  status.value = { checkin_enabled: true }
  records.draw = { items: [], total: 0, loading: false }
  records.ticket = { items: [], total: 0, loading: false }
})

afterEach(async () => {
  await i18next.changeLanguage('en')
})

describe('draw records page', () => {
  it('hides the history while the lottery is switched off', () => {
    status.value = { checkin_enabled: false }

    render(<CheckinLotteryRecords />)

    expect(
      screen.getByText('Daily draw is not available right now')
    ).toBeVisible()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('shows a placeholder row per page slot while loading', () => {
    records.draw = { items: [], total: 0, loading: true }

    const { container } = render(<CheckinLotteryRecords />)

    expect(container.querySelectorAll("[data-slot='skeleton']")).toHaveLength(5)
    expect(screen.queryByText('No prize records yet')).not.toBeInTheDocument()
  })

  it('lists every prize that was paid out', () => {
    records.draw = { items: drawItems, total: 2, loading: false }

    render(<CheckinLotteryRecords />)

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByText('¥0.50')).toBeVisible()
    expect(within(rows[1] as HTMLElement).getByText('¥0.05')).toBeVisible()
    expect(screen.getAllByText('Prize paid out')).toHaveLength(2)
  })

  it('has an empty state before the first draw', () => {
    render(<CheckinLotteryRecords />)

    expect(screen.getByText('No prize records yet')).toBeVisible()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('explains each ticket ledger entry on the second tab', async () => {
    const user = userEvent.setup()
    records.ticket = { items: ticketItems, total: 5, loading: false }

    render(<CheckinLotteryRecords />)

    await user.click(screen.getByRole('tab', { name: 'Ticket history' }))

    expect(screen.getByText('Daily check-in')).toBeVisible()
    expect(screen.getByText('Lottery draw')).toBeVisible()
    expect(screen.getByText('Refund')).toBeVisible()
    expect(screen.getByText('Top-up bonus')).toBeVisible()
    // 邀请奖励只在好友首充时结算一次，流水文案必须写明「首充」
    expect(screen.getByText('Invite friend first-top-up bonus')).toBeVisible()
    expect(screen.getAllByText('+1')).toHaveLength(4)
    expect(screen.getByText('-1')).toBeVisible()
  })

  it('labels a spent ticket as a lottery draw, not as an image-generation job', async () => {
    const user = userEvent.setup()
    records.ticket = { items: ticketItems, total: 5, loading: false }
    i18next.addResourceBundle(
      'zhCN',
      'translation',
      zhCN.translation,
      true,
      true
    )
    await i18next.changeLanguage('zhCN')

    render(<CheckinLotteryRecords />)

    await user.click(screen.getByRole('tab', { name: '次数流水' }))

    expect(screen.getByText('抽奖')).toBeVisible()
    expect(screen.queryByText('绘图')).not.toBeInTheDocument()
  })

  it('paginates with the row count the server reported', async () => {
    const user = userEvent.setup()
    records.draw = { items: drawItems, total: 25, loading: false }

    render(<CheckinLotteryRecords />)

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByText('1')).toBeVisible()
    expect(screen.getByText('3')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(screen.getByText('2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  })
})
