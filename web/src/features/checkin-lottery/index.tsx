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
import { Link } from '@tanstack/react-router'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { LotteryDrawCard } from './components/lottery-draw-card'
import { LotteryStats } from './components/lottery-stats'
import { LotteryUnavailableCard } from './components/lottery-unavailable-card'
import { LuckLeaderboard } from './components/luck-leaderboard'
import { useCheckinLotteryStatus } from './hooks/use-checkin-lottery'

/**
 * Daily check-in lottery page: claim the daily draws, spend them on the
 * prize pool and watch the luck leaderboard move.
 */
export function CheckinLottery() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const user = useAuthStore((state) => state.auth.user)

  const enabled = Boolean(status?.checkin_enabled)
  const lotteryQuery = useCheckinLotteryStatus(enabled)
  const payload = lotteryQuery.data?.data
  const loading = enabled && lotteryQuery.isPending

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='block truncate'>{t('Daily draw')}</span>
        <span className='text-muted-foreground block truncate text-xs font-normal'>
          {t('Claim your daily draws and convert them into balance rewards')}
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
          render={<Link to='/checkin/records' />}
        >
          <History className='size-4' />
          {t('Draw records')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-5'>
          {!enabled && <LotteryUnavailableCard />}
          {enabled && loading && <DrawPageSkeleton />}
          {enabled && !loading && (
            <>
              <LotteryStats
                tickets={payload?.tickets ?? 0}
                dailyTickets={payload?.daily_tickets ?? 0}
                bonusTickets={payload?.bonus_tickets ?? 0}
                dailyDraws={payload?.daily_draws ?? 1}
                topUpYuanPerDraw={payload?.topup_yuan_per_draw ?? 0}
                balanceQuota={user?.quota ?? 0}
              />

              <LotteryDrawCard
                prizes={payload?.prizes ?? []}
                tickets={payload?.tickets ?? 0}
                checkedInToday={payload?.checked_in_today ?? false}
              />

              <LuckLeaderboard
                entries={payload?.leaderboard ?? []}
                stats={
                  payload?.stats ?? {
                    total_draws: 0,
                    total_amount: 0,
                    best_amount: 0,
                  }
                }
                rank={payload?.rank ?? 0}
                myUserId={user?.id}
              />
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

/** Placeholder shown while the first lottery snapshot is loading. */
function DrawPageSkeleton() {
  return (
    <>
      <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
        {['tickets', 'today', 'daily', 'balance'].map((key) => (
          <Skeleton key={key} className='h-28 w-full rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-72 w-full rounded-xl' />
      <Skeleton className='h-64 w-full rounded-xl' />
    </>
  )
}
