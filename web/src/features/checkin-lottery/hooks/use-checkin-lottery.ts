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
import { useQuery } from '@tanstack/react-query'

import { requireServerSuccess } from '@/lib/server-error-message'

import { getCheckinLotteryStatus } from '../api'

export const CHECKIN_LOTTERY_QUERY_KEY = ['checkin-lottery'] as const

/**
 * Load the check-in lottery snapshot. The payload is small and changes on
 * every draw, so the cache stays short-lived.
 */
export function useCheckinLotteryStatus(enabled = true) {
  return useQuery({
    queryKey: CHECKIN_LOTTERY_QUERY_KEY,
    queryFn: async () => requireServerSuccess(await getCheckinLotteryStatus()),
    enabled,
    staleTime: 15 * 1000,
  })
}
