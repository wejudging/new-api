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
import { Crown } from 'lucide-react'

import { cn } from '@/lib/utils'

import { formatProbability, formatYuan } from '../lib/format'
import type { CheckinLotteryPrize } from '../types'

interface PrizeBoardProps {
  prizes: CheckinLotteryPrize[]
  /** Tier currently highlighted by the rolling animation. */
  rollingIndex: number | null
  /** Amount of the tier the last draw landed on. */
  wonAmount: number | null
  disabled?: boolean
}

/**
 * The prize pool grid. Every tier shows its amount and draw probability so
 * users can see the odds instead of guessing them.
 */
export function PrizeBoard(props: PrizeBoardProps) {
  const topAmount = props.prizes.reduce(
    (max, prize) => (prize.amount > max ? prize.amount : max),
    0
  )

  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3',
        props.disabled && 'opacity-60'
      )}
    >
      {props.prizes.map((prize, index) => {
        const isRolling = props.rollingIndex === index && props.disabled
        const isWon =
          !props.disabled &&
          props.wonAmount != null &&
          prize.amount === props.wonAmount
        const isTop = prize.amount === topAmount && topAmount > 0

        return (
          <div
            key={`${prize.amount}-${prize.weight}`}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 transition-all duration-200 sm:py-4',
              'border-border/70 bg-card',
              isRolling &&
                'border-primary bg-primary/10 scale-[1.04] shadow-sm',
              isWon && 'border-success bg-success/10 shadow-sm',
              !isRolling && !isWon && 'hover:border-primary/40'
            )}
          >
            {isTop && (
              <Crown className='text-warning absolute top-1.5 right-1.5 size-3.5' />
            )}
            <span
              className={cn(
                'font-mono text-base font-bold tracking-tight tabular-nums sm:text-lg',
                isWon ? 'text-success' : 'text-foreground'
              )}
            >
              {formatYuan(prize.amount)}
            </span>
            <span className='text-muted-foreground/80 text-[0.7rem] tabular-nums'>
              {formatProbability(prize.probability)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
