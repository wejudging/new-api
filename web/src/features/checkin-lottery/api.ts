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
import { api } from '@/lib/api'

import type {
  CheckinLotteryApiResponse,
  CheckinLotteryDrawRecord,
  CheckinLotteryDrawResult,
  CheckinLotteryRecordPage,
  CheckinLotteryReferral,
  CheckinLotteryStatus,
  CheckinLotteryTicketRecord,
} from './types'

// ============================================================================
// Check-in Lottery APIs
// ============================================================================

/**
 * Get the check-in lottery status: prize pool, available draws, personal
 * statistics, rank and the luck leaderboard.
 */
export async function getCheckinLotteryStatus(): Promise<
  CheckinLotteryApiResponse<CheckinLotteryStatus>
> {
  const res = await api.get('/api/user/lottery')
  return res.data
}

/**
 * Draw once. When the user has no ticket left the backend claims today's
 * check-in automatically before drawing.
 */
export async function drawCheckinLottery(
  turnstileToken?: string
): Promise<CheckinLotteryApiResponse<CheckinLotteryDrawResult>> {
  const url = turnstileToken
    ? `/api/user/lottery/draw?turnstile=${encodeURIComponent(turnstileToken)}`
    : '/api/user/lottery/draw'
  const res = await api.post(url)
  return res.data
}

/**
 * Load one page of the personal lottery history.
 *
 * `type=draw` returns the prize records, `type=ticket` returns the ticket
 * ledger (every granted and spent entry).
 */
export async function getCheckinLotteryRecords<T>(options: {
  type: 'draw' | 'ticket'
  page: number
  pageSize: number
}): Promise<CheckinLotteryApiResponse<CheckinLotteryRecordPage<T>>> {
  const params = new URLSearchParams({
    type: options.type,
    p: String(options.page),
    page_size: String(options.pageSize),
  })
  const res = await api.get(`/api/user/lottery/records?${params.toString()}`)
  return res.data
}

/** Prize records of the signed-in user, newest first. */
export function getCheckinLotteryDrawRecords(options: {
  page: number
  pageSize: number
}) {
  return getCheckinLotteryRecords<CheckinLotteryDrawRecord>({
    ...options,
    type: 'draw',
  })
}

/** Ticket ledger of the signed-in user, newest first. */
export function getCheckinLotteryTicketRecords(options: {
  page: number
  pageSize: number
}) {
  return getCheckinLotteryRecords<CheckinLotteryTicketRecord>({
    ...options,
    type: 'ticket',
  })
}

/**
 * Load the invite-friend summary together with the invitee breakdown.
 *
 * The snapshot endpoint already carries the headline numbers, this one adds
 * the per-invitee list used by the referral card dialog.
 */
export async function getCheckinLotteryReferral(): Promise<
  CheckinLotteryApiResponse<CheckinLotteryReferral>
> {
  const res = await api.get('/api/user/lottery/referral')
  return res.data
}
