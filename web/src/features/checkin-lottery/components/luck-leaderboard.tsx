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

const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

/** Warm ramp for the podium, so the top three read at a glance. */
const PODIUM_BARS: Record<number, string> = {
  1: 'bg-gradient-to-r from-amber-400 to-amber-500',
  2: 'bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600',
  3: 'bg-gradient-to-r from-amber-600 to-amber-700',
}

const DEFAULT_BAR = 'bg-gradient-to-r from-primary/60 to-primary'

/** Avatar tint, cycled by user id so the same player keeps their colour. */
const AVATAR_TONES = [
  'bg-chart-1/15 text-chart-1',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
  'bg-chart-4/15 text-chart-4',
  'bg-chart-5/15 text-chart-5',
]

/**
 * Luck leaderboard: the top ten players by total winnings, followed by a
 * highlighted summary bar for the signed-in user's own position.
 *
 * Rows borrow the shape of a contribution graph — rank, avatar, name, a bar
 * scaled against the current leader and the payout on the right. The bar is
 * what fills the stretch of empty space the plain two-column list used to
 * leave in the middle of every row.
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

  const maxTotal = props.entries.reduce(
    (max, entry) => (entry.total_amount > max ? entry.total_amount : max),
    0
  )

  return (
    <ul className='divide-border/60 divide-y'>
      {props.entries.map((entry) => {
        const isMe = props.myUserId != null && entry.user_id === props.myUserId
        const medal = RANK_MEDALS[entry.rank]
        // Every bar keeps a sliver so a small win still shows up next to a
        // much larger one instead of collapsing to nothing.
        const share =
          maxTotal > 0 ? Math.max(6, (entry.total_amount / maxTotal) * 100) : 0

        return (
          <li
            key={`${entry.rank}-${entry.user_id}`}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 transition-colors sm:px-5',
              isMe && 'bg-primary/5'
            )}
          >
            {medal ? (
              <span
                aria-hidden='true'
                className='flex size-6 shrink-0 items-center justify-center text-base leading-none'
              >
                {medal}
              </span>
            ) : (
              <span className='bg-muted/60 text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums'>
                {entry.rank}
              </span>
            )}

            <span
              aria-hidden='true'
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase',
                AVATAR_TONES[entry.user_id % AVATAR_TONES.length]
              )}
            >
              {entry.username.slice(0, 1) || '?'}
            </span>

            <div className='min-w-0 flex-1'>
              <div className='flex items-baseline gap-1.5'>
                <span className='truncate text-sm font-medium'>
                  {entry.username}
                </span>
                {entry.account ? (
                  <span className='text-muted-foreground/50 truncate text-xs'>
                    {entry.account}
                  </span>
                ) : null}
              </div>
              <div className='mt-1 flex items-center gap-2'>
                <span className='text-muted-foreground/60 shrink-0 text-[11px] tabular-nums'>
                  {t('{{count}} draws', { count: entry.draws })}
                </span>
                <span className='bg-muted/70 h-1.5 min-w-6 flex-1 overflow-hidden rounded-full'>
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      PODIUM_BARS[entry.rank] ?? DEFAULT_BAR
                    )}
                    style={{ width: `${share}%` }}
                  />
                </span>
              </div>
            </div>

            <div className='w-[72px] shrink-0 text-right'>
              <div className='text-success font-mono text-sm font-bold tabular-nums sm:text-base'>
                {formatYuan(entry.best_amount)}
              </div>
              <div className='text-muted-foreground/60 text-[11px] tabular-nums'>
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
