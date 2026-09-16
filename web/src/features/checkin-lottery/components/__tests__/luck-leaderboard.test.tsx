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
import { describe, expect, it } from 'vitest'

import type { CheckinLotteryLeaderboardEntry } from '../../types'
import { LuckLeaderboard } from '../luck-leaderboard'

const entries: CheckinLotteryLeaderboardEntry[] = Array.from(
  { length: 20 },
  (_, index) => ({
    rank: index + 1,
    user_id: 100 + index,
    username: `user${index}`,
    account: `u***${index}@g***.com`,
    draws: 22 - index,
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

    expect(screen.getAllByRole('listitem')).toHaveLength(20)
    expect(screen.getByText('user0')).toBeVisible()
    expect(screen.getByText('user19')).toBeVisible()
    expect(
      screen.getByText('Top 20 players ranked by total winnings')
    ).toBeVisible()
  })

  it('awards medals to the top three rows and numbers the rest', () => {
    renderBoard({})

    for (const [index, medal] of ['🥇', '🥈', '🥉'].entries()) {
      const row = screen.getByText(`user${index}`).closest('li')
      expect(row).not.toBeNull()
      if (!row) continue

      expect(within(row).getByText(medal)).toBeVisible()
    }

    const fourth = screen.getByText('user3').closest('li')
    expect(fourth).not.toBeNull()
    if (fourth) {
      expect(within(fourth).getByText('4')).toBeVisible()
      expect(within(fourth).queryByText('🥇')).toBeNull()
    }
  })

  it('shows the full username in front of the masked email', () => {
    renderBoard({})

    const row = screen.getByText('user0').closest('li')
    expect(row).not.toBeNull()
    if (!row) return

    const username = within(row).getByText('user0')
    const email = within(row).getByText('u***0@g***.com')

    expect(username).toBeVisible()
    expect(email).toBeVisible()
    expect(username.textContent).not.toContain('*')
    expect(
      username.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('shows the personal rank underneath the board', () => {
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
