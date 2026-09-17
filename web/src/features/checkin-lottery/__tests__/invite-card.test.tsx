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
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InviteFriendsCard } from '../components/invite-friends-card'
import type { CheckinLotteryReferral } from '../types'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({ to, children }: { to?: string; children?: React.ReactNode }) => (
    <a href={typeof to === 'string' ? to : undefined}>{children}</a>
  ),
}))

const NOTE =
  'Paid once on the first top-up, on the credited amount; your friend also keeps the top-up bonus.'

function referral(
  overrides: Partial<CheckinLotteryReferral> = {}
): CheckinLotteryReferral {
  return {
    aff_code: 'abcd',
    invite_count: 0,
    rewarded_count: 0,
    tickets: 0,
    base_tickets: 1,
    step_yuan: 10,
    enabled: true,
    ...overrides,
  }
}

describe('invite friends card', () => {
  it('states the payout and the terms in a single line of fine print', () => {
    render(<InviteFriendsCard referral={referral()} />)

    // 规则行与后端结算保持一致：基础次数是叠加，不是顶替；补充说明并入同一段
    const rule = screen.getByText(
      /Every ¥10 your friend tops up pays you 1 ticket and your friend 2, plus 1 ticket\(s\) each\./
    )
    expect(rule).toBeVisible()
    expect(rule.textContent).toContain(NOTE)
  })

  it('drops the ladder table and the old three-line terms block', () => {
    render(<InviteFriendsCard referral={referral()} />)

    // 阶梯表格已下线，避免和规则行重复
    expect(screen.queryByText('Invite reward ladder')).not.toBeInTheDocument()
    expect(screen.queryByText('You get')).not.toBeInTheDocument()
    expect(screen.queryByText('Your friend gets')).not.toBeInTheDocument()
    expect(screen.queryByText('Less than ¥10')).not.toBeInTheDocument()
    expect(screen.queryByText('Any first top-up')).not.toBeInTheDocument()

    // 三段小字压缩成一行，卡片变得更矮
    expect(
      screen.queryByText(
        'Your friend keeps their own top-up bonus, so every ¥10 adds 2 tickets on their side.'
      )
    ).toBeNull()
    expect(
      screen.queryByText('Tickets are paid once, on the first top-up only.')
    ).toBeNull()
  })

  it('drops the doubling note when the step payout is off', () => {
    render(
      <InviteFriendsCard
        referral={referral({ base_tickets: 3, step_yuan: 0 })}
      />
    )

    const rule = screen.getByText(
      /Your friend's first top-up pays 3 ticket\(s\) to both of you\./
    )
    expect(rule).toBeVisible()
    // 只发基础次数时不该再出现「你 +1 好友 +2」的说法
    expect(rule.textContent).not.toContain('your friend 2')
    expect(rule.textContent).toContain(NOTE)
  })

  it('carries the three counters and the merged record entry', () => {
    render(
      <InviteFriendsCard
        referral={referral({ invite_count: 4, rewarded_count: 2, tickets: 7 })}
      />
    )

    expect(screen.getByText('Invited')).toBeVisible()
    expect(screen.getByText('Settled')).toBeVisible()
    expect(screen.getByText('Tickets')).toBeVisible()
    expect(screen.getByText('4')).toBeVisible()
    expect(screen.getByText('2')).toBeVisible()
    expect(screen.getByText('7')).toBeVisible()
    expect(screen.getByRole('link', { name: /My records/ })).toHaveAttribute(
      'href',
      '/checkin/records'
    )
  })

  it('hides the terms while the program is off', () => {
    render(<InviteFriendsCard referral={referral({ enabled: false })} />)

    expect(
      screen.getAllByText('Invite rewards are turned off right now.').length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText('Tickets are paid once, on the first top-up only.')
    ).toBeNull()
    expect(screen.queryByText(new RegExp(NOTE))).toBeNull()
  })
})
