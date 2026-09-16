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

import { getCheckinLotteryReferral } from '../api'
import type { CheckinLotteryReferralInvitee } from '../types'

export const CHECKIN_LOTTERY_REFERRAL_QUERY_KEY = [
  'checkin-lottery-referral',
] as const

/**
 * Load the invitee breakdown of the invite-friend program.
 *
 * The draw page already receives the headline numbers with its snapshot, so
 * this request is only fired when the invite records dialog is opened.
 */
export function useCheckinLotteryReferral(enabled = true) {
  const query = useQuery({
    queryKey: CHECKIN_LOTTERY_REFERRAL_QUERY_KEY,
    queryFn: async () =>
      requireServerSuccess(await getCheckinLotteryReferral()),
    enabled,
    staleTime: 30 * 1000,
  })

  return {
    data: query.data?.data,
    invitees: (query.data?.data?.invitees ??
      []) as CheckinLotteryReferralInvitee[],
    loading: query.isPending,
    error: query.error,
  }
}
