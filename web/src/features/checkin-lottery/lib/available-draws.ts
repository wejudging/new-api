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
import type { CheckinLotteryStatus } from '../types'

/** Draws the user can really spend, today's unclaimed daily draw included. */
export interface AvailableDraws {
  tickets: number
  dailyTickets: number
  bonusTickets: number
}

type AvailableDrawsSource = Pick<
  CheckinLotteryStatus,
  'daily_tickets' | 'bonus_tickets' | 'daily_draws' | 'checked_in_today'
>

/**
 * Resolve the draw counters shown on the page.
 *
 * The daily draw is claimed lazily by `POST /api/user/lottery/draw`, so a
 * status response that has not been claimed yet still reports `0/1` even
 * though the button can draw. Folding today's unclaimed draw into the counters
 * keeps the headline numbers in sync with what the action actually does.
 */
export function resolveAvailableDraws(
  status: AvailableDrawsSource
): AvailableDraws {
  const dailyDraws = status.daily_draws > 0 ? status.daily_draws : 1
  const claimableToday = status.checked_in_today ? 0 : dailyDraws
  const dailyTickets = Math.min(
    dailyDraws,
    Math.max(0, status.daily_tickets) + claimableToday
  )
  const bonusTickets = Math.max(0, status.bonus_tickets)
  return {
    tickets: dailyTickets + bonusTickets,
    dailyTickets,
    bonusTickets,
  }
}
