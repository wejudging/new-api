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
import { describe, expect, it } from 'vitest'

import { InviteFriendsCard } from '../components/invite-friends-card'
import type { CheckinLotteryReferral } from '../types'

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
  it('states the stacked payout in one rule line, without the ladder table', () => {
    render(<InviteFriendsCard referral={referral()} />)

    // 规则行与后端结算保持一致：基础次数是叠加，不是顶替
    expect(
      screen.getByText(
        'Every ¥10 your friend tops up pays you 1 ticket and your friend 2, plus 1 ticket(s) each.'
      )
    ).toBeVisible()

    // 阶梯表格已下线，避免和规则行重复
    expect(screen.queryByText('Invite reward ladder')).not.toBeInTheDocument()
    expect(screen.queryByText('You get')).not.toBeInTheDocument()
    expect(screen.queryByText('Your friend gets')).not.toBeInTheDocument()
    expect(screen.queryByText('Less than ¥10')).not.toBeInTheDocument()
    expect(screen.queryByText('Any first top-up')).not.toBeInTheDocument()
  })

  it('keeps the terms a reader cannot infer from the rule', () => {
    render(<InviteFriendsCard referral={referral()} />)

    expect(
      screen.getByText(
        'Your friend keeps their own top-up bonus, so every ¥10 adds 2 tickets on their side.'
      )
    ).toBeVisible()
    expect(
      screen.getByText(
        'The credited amount counts, so a discounted top-up qualifies.'
      )
    ).toBeVisible()
    expect(
      screen.getByText('Tickets are paid once, on the first top-up only.')
    ).toBeVisible()
  })

  it('drops the doubling note when the step payout is off', () => {
    render(
      <InviteFriendsCard
        referral={referral({ base_tickets: 3, step_yuan: 0 })}
      />
    )

    expect(
      screen.getByText(
        "Your friend's first top-up pays 3 ticket(s) to both of you."
      )
    ).toBeVisible()
    expect(screen.queryByText(/adds 2 tickets on their side/)).toBeNull()
    expect(
      screen.getByText('Tickets are paid once, on the first top-up only.')
    ).toBeVisible()
  })

  it('hides the terms while the program is off', () => {
    render(<InviteFriendsCard referral={referral({ enabled: false })} />)

    expect(
      screen.getAllByText('Invite rewards are turned off right now.').length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText('Tickets are paid once, on the first top-up only.')
    ).toBeNull()
  })
})
