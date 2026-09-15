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
  CheckinLotteryDrawResult,
  CheckinLotteryStatus,
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
