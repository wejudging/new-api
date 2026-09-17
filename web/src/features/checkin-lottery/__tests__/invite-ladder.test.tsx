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

describe('invite reward ladder', () => {
  it('spells out the stacked payout the backend pays', () => {
    render(<InviteFriendsCard referral={referral()} />)

    expect(screen.getByText('Invite reward ladder')).toBeVisible()

    // 首充不足 ¥10：双方只拿基础次数
    expect(screen.getByText('Less than ¥10')).toBeVisible()
    expect(screen.getAllByText('1 tickets')).toHaveLength(2)

    // 首充 ¥10：基础 1 次 + 1 档 → 你 2 次、好友 3 次
    expect(screen.getByText('2 tickets')).toBeVisible()
    expect(screen.getByText('3 tickets')).toBeVisible()

    // 首充 ¥100：基础 1 次 + 10 档 → 你 11 次、好友 21 次
    expect(screen.getByText('11 tickets')).toBeVisible()
    expect(screen.getByText('21 tickets')).toBeVisible()

    // 规则行与阶梯数字保持一致：基础次数是叠加，不是顶替
    expect(
      screen.getByText(
        'Every ¥10 your friend tops up pays you 1 ticket and your friend 2, plus 1 ticket(s) each.'
      )
    ).toBeVisible()

    // 「仅限首次充值」在开启档位时也必须可见，不能只在关闭档位时才出现
    expect(
      screen.getByText('Tickets are paid once, on the first top-up only.')
    ).toBeVisible()
  })

  it('falls back to a single flat row when the step is off', () => {
    render(
      <InviteFriendsCard
        referral={referral({ base_tickets: 3, step_yuan: 0 })}
      />
    )

    expect(screen.getByText('Any first top-up')).toBeVisible()
    expect(screen.getAllByText('3 tickets')).toHaveLength(2)
    expect(
      screen.getByText('Tickets are paid once, on the first top-up only.')
    ).toBeVisible()
  })

  it('hides the ladder while the program is off', () => {
    render(<InviteFriendsCard referral={referral({ enabled: false })} />)

    expect(screen.queryByText('Invite reward ladder')).not.toBeInTheDocument()
    expect(
      screen.getAllByText('Invite rewards are turned off right now.').length
    ).toBeGreaterThan(0)
  })
})
