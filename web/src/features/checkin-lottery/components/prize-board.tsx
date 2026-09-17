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

import { formatYuan } from '../lib/format'
import type { CheckinLotteryPrize } from '../types'

interface PrizeBoardProps {
  prizes: CheckinLotteryPrize[]
  /** Tier currently highlighted by the rolling animation. */
  rollingIndex: number | null
  /** Tier the last draw landed on, highlighted once the roll has stopped. */
  wonIndex: number | null
  disabled?: boolean
}

/**
 * The prize pool grid, four columns by three rows for the default twelve
 * tiers. Every tier only shows its amount: the odds stay in the backend so the
 * pool can be tuned without publishing the distribution.
 */
export function PrizeBoard(props: PrizeBoardProps) {
  const topAmount = props.prizes.reduce(
    (max, prize) => (prize.amount > max ? prize.amount : max),
    0
  )

  return (
    <div
      className={cn(
        'grid grid-cols-4 gap-2 sm:gap-3',
        props.disabled && 'select-none'
      )}
    >
      {props.prizes.map((prize, index) => {
        // The landed tier and the won tier are the same index, so the
        // highlight the roll stops on is always the tier that pays out.
        const isRolling = props.rollingIndex === index
        const isWon = props.rollingIndex == null && props.wonIndex === index
        const isTop = prize.amount === topAmount && topAmount > 0

        return (
          <div
            key={`${prize.amount}-${prize.weight}`}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 transition-all duration-200 sm:py-4',
              'border-border/70 bg-card',
              // The top tier breathes so the pool has some life in it even
              // while nobody is drawing.
              isTop &&
                !isRolling &&
                !isWon &&
                'checkin-tile-top border-warning/40',
              isRolling &&
                'checkin-tile-rolling border-primary bg-primary/10 shadow-primary/25 scale-[1.07] shadow-lg',
              isWon &&
                'checkin-tile-won border-success bg-success/10 shadow-success/25 shadow-lg',
              !isRolling && !isWon && 'hover:border-primary/40'
            )}
          >
            {isTop && (
              <Crown className='text-warning absolute top-1.5 right-1.5 size-3.5' />
            )}
            <span
              className={cn(
                'font-mono text-base font-bold tracking-tight tabular-nums sm:text-xl',
                isWon ? 'text-success' : 'text-foreground'
              )}
            >
              {formatYuan(prize.amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
