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
// ============================================================================
// Check-in Lottery Type Definitions
// ============================================================================

/** Generic API response envelope */
export interface CheckinLotteryApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

/** A single prize tier of the lottery pool */
export interface CheckinLotteryPrize {
  /** Prize amount in CNY yuan */
  amount: number
  /** Draw weight, the larger the more likely */
  weight: number
  /** Normalised probability in the range 0-1 */
  probability: number
}

/** Per-user lottery statistics */
export interface CheckinLotteryStats {
  total_draws: number
  total_amount: number
  best_amount: number
}

/** One row of the luck leaderboard */
export interface CheckinLotteryLeaderboardEntry {
  rank: number
  user_id: number
  /** Partially masked username, e.g. `h***i`; the server does the masking */
  username: string
  /** Masked email, e.g. `r***@g***.com`; empty when the user has no email */
  account: string
  draws: number
  best_amount: number
  total_amount: number
}

/** Response of `GET /api/user/lottery` */
export interface CheckinLotteryStatus {
  enabled: boolean
  /** Whether the draw is restricted to accounts that have topped up */
  require_topup: boolean
  /** Whether the signed-in user already has a successful top-up */
  topup_satisfied: boolean
  daily_draws: number
  /** Daily tickets that reset every day (never accumulate) */
  daily_tickets: number
  /** Permanent tickets granted by top-ups */
  bonus_tickets: number
  /** Credited amount in CNY that grants one extra ticket, `0` disables it */
  topup_yuan_per_draw: number
  tickets: number
  checked_in_today: boolean
  prizes: CheckinLotteryPrize[]
  /** Expected prize amount per draw, in CNY yuan */
  expected_amount: number
  stats: CheckinLotteryStats
  /** Leaderboard position, `0` when the user has no winnings yet */
  rank: number
  leaderboard: CheckinLotteryLeaderboardEntry[]
  leaderboard_count: number
}

/** Response of `POST /api/user/lottery/draw` */
export interface CheckinLotteryDrawResult {
  amount: number
  quota: number
  tickets: number
  checked_in_today: boolean
  stats: CheckinLotteryStats
  rank: number
}

/** Pagination envelope shared by the lottery record endpoints */
export interface CheckinLotteryRecordPage<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

/** One row of `GET /api/user/lottery/records?type=draw` */
export interface CheckinLotteryDrawRecord {
  id: number
  user_id: number
  /** Prize amount in CNY yuan */
  amount: number
  /** Quota actually credited to the balance */
  quota: number
  created_at: number
}

/** Reason of a ticket ledger entry */
export type CheckinLotteryTicketReason = 'claim' | 'draw' | 'refund' | 'topup'

/** One row of `GET /api/user/lottery/records?type=ticket` */
export interface CheckinLotteryTicketRecord {
  id: number
  user_id: number
  /** `+1` when granted, `-1` when spent */
  delta: number
  reason: CheckinLotteryTicketReason
  created_at: number
}
