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

import type { CheckinLotteryLeaderboardEntry } from '../../types'
import { LuckLeaderboard } from '../luck-leaderboard'

const entries: CheckinLotteryLeaderboardEntry[] = Array.from(
  { length: 10 },
  (_, index) => ({
    rank: index + 1,
    user_id: 100 + index,
    account: `u***${index}@g***.com`,
    draws: 12 - index,
    best_amount: 0.5,
    total_amount: 2.4 - index * 0.1,
  })
)

function renderBoard(overrides: {
  rank?: number
  entries?: CheckinLotteryLeaderboardEntry[]
  myUserId?: number
}) {
  return render(
    <LuckLeaderboard
      entries={overrides.entries ?? entries}
      stats={{ total_draws: 12, total_amount: 1.3, best_amount: 0.5 }}
      rank={overrides.rank ?? 0}
      myUserId={overrides.myUserId}
    />
  )
}

describe('luck leaderboard', () => {
  it('lists exactly the rows the server returned', () => {
    renderBoard({})

    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('u***0@g***.com')).toBeVisible()
    expect(screen.getByText('u***9@g***.com')).toBeVisible()
  })

  it('shows the personal rank underneath the top ten', () => {
    renderBoard({ rank: 42, myUserId: 999 })

    expect(
      screen.getByText('Your rank #42, best single draw ¥0.50')
    ).toBeVisible()
  })

  it('nudges users who are not on the leaderboard yet', () => {
    renderBoard({ rank: 0 })

    expect(
      screen.getByText('Not on the leaderboard yet, try your luck today')
    ).toBeVisible()
  })

  it('renders an empty state before the first draw', () => {
    renderBoard({ entries: [] })

    expect(
      screen.getByText('No draws yet, be the first on the leaderboard')
    ).toBeVisible()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
