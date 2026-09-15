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
import { Crown, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { formatRank, formatYuan } from '../lib/format'
import type {
  CheckinLotteryLeaderboardEntry,
  CheckinLotteryStats,
} from '../types'

interface LuckLeaderboardProps {
  entries: CheckinLotteryLeaderboardEntry[]
  stats: CheckinLotteryStats
  rank: number
  myUserId?: number
  loading?: boolean
}

function rankToneClass(rank: number): string {
  if (rank === 1) return 'bg-warning/15 text-warning'
  if (rank === 2) return 'bg-muted text-foreground'
  if (rank === 3) return 'bg-chart-4/15 text-chart-4'
  return 'bg-muted/60 text-muted-foreground'
}

/**
 * Luck leaderboard: the top ten players by total winnings, followed by a
 * highlighted summary bar for the signed-in user's own position.
 */
export function LuckLeaderboard(props: LuckLeaderboardProps) {
  const { t } = useTranslation()

  const mySummary =
    props.rank > 0
      ? t('Your rank {{rank}}, best single draw {{amount}}', {
          rank: formatRank(props.rank),
          amount: formatYuan(props.stats.best_amount),
        })
      : t('Not on the leaderboard yet, try your luck today')

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='border-b px-4 py-3.5 sm:px-5'>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <Crown className='text-warning size-4' />
          {t('Luck leaderboard')}
        </CardTitle>
        <CardDescription className='text-xs'>
          {t('Top 10 players ranked by total winnings')}
        </CardDescription>
      </CardHeader>

      <CardContent className='px-0 pb-0'>
        <LeaderboardBody
          loading={props.loading}
          entries={props.entries}
          myUserId={props.myUserId}
        />

        <div className='bg-success/10 text-success border-t px-4 py-3 text-center text-sm font-medium sm:px-5'>
          {mySummary}
        </div>
      </CardContent>
    </Card>
  )
}

interface LeaderboardBodyProps {
  loading?: boolean
  entries: CheckinLotteryLeaderboardEntry[]
  myUserId?: number
}

function LeaderboardBody(props: LeaderboardBodyProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='space-y-2 px-4 py-4 sm:px-5'>
        {['1', '2', '3', '4', '5'].map((key) => (
          <Skeleton key={key} className='h-10 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  if (props.entries.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col items-center gap-2 px-4 py-10 text-center text-sm'>
        <Sparkles className='size-5' />
        {t('No draws yet, be the first on the leaderboard')}
      </div>
    )
  }

  return (
    <ul className='divide-border/60 divide-y'>
      {props.entries.map((entry) => {
        const isMe = props.myUserId != null && entry.user_id === props.myUserId
        return (
          <li
            key={`${entry.rank}-${entry.user_id}`}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 sm:px-5',
              isMe && 'bg-primary/5'
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums',
                rankToneClass(entry.rank)
              )}
            >
              {entry.rank}
            </span>

            <div className='min-w-0 flex-1'>
              <div className='truncate text-sm font-medium'>
                {entry.account}
              </div>
              <div className='text-muted-foreground/70 text-xs'>
                {t('{{count}} draws', { count: entry.draws })}
              </div>
            </div>

            <div className='shrink-0 text-right'>
              <div className='text-success font-mono text-sm font-bold tabular-nums sm:text-base'>
                {formatYuan(entry.best_amount)}
              </div>
              <div className='text-muted-foreground/70 text-xs'>
                {t('Total {{amount}}', {
                  amount: formatYuan(entry.total_amount),
                })}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
