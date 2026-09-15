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
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { requireServerSuccess } from '@/lib/server-error-message'

import {
  getCheckinLotteryDrawRecords,
  getCheckinLotteryTicketRecords,
} from '../api'
import type {
  CheckinLotteryDrawRecord,
  CheckinLotteryTicketRecord,
} from '../types'

/** Records are immutable once written, so the cache can stay warm for a while. */
const RECORDS_STALE_TIME = 60 * 1000

interface PageQueryOptions {
  page: number
  pageSize: number
}

/** Prize records of the signed-in user, newest first. */
export function useCheckinLotteryDrawRecords(options: PageQueryOptions) {
  const { page, pageSize } = options
  const query = useQuery({
    queryKey: ['checkin-lottery-records', 'draw', page, pageSize],
    queryFn: async () =>
      requireServerSuccess(
        await getCheckinLotteryDrawRecords({ page, pageSize })
      ),
    placeholderData: keepPreviousData,
    staleTime: RECORDS_STALE_TIME,
  })

  return {
    items: (query.data?.data?.items ?? []) as CheckinLotteryDrawRecord[],
    total: query.data?.data?.total ?? 0,
    loading: query.isPending,
  }
}

/** Ticket ledger of the signed-in user, newest first. */
export function useCheckinLotteryTicketRecords(options: PageQueryOptions) {
  const { page, pageSize } = options
  const query = useQuery({
    queryKey: ['checkin-lottery-records', 'ticket', page, pageSize],
    queryFn: async () =>
      requireServerSuccess(
        await getCheckinLotteryTicketRecords({ page, pageSize })
      ),
    placeholderData: keepPreviousData,
    staleTime: RECORDS_STALE_TIME,
  })

  return {
    items: (query.data?.data?.items ?? []) as CheckinLotteryTicketRecord[],
    total: query.data?.data?.total ?? 0,
    loading: query.isPending,
  }
}
