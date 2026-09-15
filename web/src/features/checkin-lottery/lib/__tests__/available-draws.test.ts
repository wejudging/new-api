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
import { describe, expect, it } from 'vitest'

import { resolveAvailableDraws } from '../available-draws'

describe('available draw counters', () => {
  it('counts today’s unclaimed daily draw as available', () => {
    expect(
      resolveAvailableDraws({
        daily_tickets: 0,
        bonus_tickets: 0,
        daily_draws: 1,
        checked_in_today: false,
      })
    ).toEqual({ tickets: 1, dailyTickets: 1, bonusTickets: 0 })
  })

  it('drops the daily draw once today was already claimed', () => {
    expect(
      resolveAvailableDraws({
        daily_tickets: 0,
        bonus_tickets: 2,
        daily_draws: 1,
        checked_in_today: true,
      })
    ).toEqual({ tickets: 2, dailyTickets: 0, bonusTickets: 2 })
  })

  it('keeps an unspent daily draw from being counted twice', () => {
    expect(
      resolveAvailableDraws({
        daily_tickets: 1,
        bonus_tickets: 0,
        daily_draws: 1,
        checked_in_today: false,
      })
    ).toEqual({ tickets: 1, dailyTickets: 1, bonusTickets: 0 })
  })

  it('adds top-up tickets on top of the daily draw', () => {
    expect(
      resolveAvailableDraws({
        daily_tickets: 0,
        bonus_tickets: 3,
        daily_draws: 1,
        checked_in_today: false,
      })
    ).toEqual({ tickets: 4, dailyTickets: 1, bonusTickets: 3 })
  })

  it('never reports negative counters', () => {
    expect(
      resolveAvailableDraws({
        daily_tickets: -1,
        bonus_tickets: -5,
        daily_draws: 0,
        checked_in_today: false,
      })
    ).toEqual({ tickets: 1, dailyTickets: 1, bonusTickets: 0 })
  })
})
