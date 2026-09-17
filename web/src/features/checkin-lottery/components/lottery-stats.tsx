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
import { CalendarCheck, Gift, Ticket, WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

interface LotteryStatsProps {
  tickets: number
  /** Daily tickets left today, capped by the site's daily draw limit. */
  dailyTickets: number
  /** Permanent tickets earned from top-ups. */
  bonusTickets: number
  /** Credited CNY that grants one extra ticket, `0` disables the bonus. */
  topUpYuanPerDraw: number
  balanceQuota: number
  loading?: boolean
}

/**
 * The four headline numbers of the draw page: total tickets, the daily
 * bucket (never accumulates), the permanent top-up bucket and the current
 * balance the prizes are paid into.
 *
 * They used to be four cards with an icon, a value and two lines of copy,
 * which ate a third of the fold before the draw even showed up. They are now
 * one strip of cells: the explanation moved into the tooltip, the counters
 * show a plain number (the daily bucket is a count, not a `0/1` score).
 */
export function LotteryStats(props: LotteryStatsProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <StatsStrip>
        {['tickets', 'daily', 'bonus', 'balance'].map((key) => (
          <StatsCell key={key}>
            <Skeleton className='size-7 shrink-0 rounded-md' />
            <div className='min-w-0 flex-1 space-y-1.5'>
              <Skeleton className='h-3 w-12' />
              <Skeleton className='h-4 w-10' />
            </div>
          </StatsCell>
        ))}
      </StatsStrip>
    )
  }

  const items: {
    label: string
    value: string
    hint: string
    icon: typeof Ticket
    tone: IconBadgeTone
  }[] = [
    {
      label: t('Available draws'),
      value: String(props.tickets),
      hint: t('Daily and top-up tickets combined'),
      icon: Ticket,
      tone: 'primary',
    },
    {
      label: t('Daily tickets'),
      value: String(props.dailyTickets),
      hint: t('Does not accumulate, back to full tomorrow'),
      icon: CalendarCheck,
      tone: props.dailyTickets > 0 ? 'success' : 'warning',
    },
    {
      label: t('Top-up bonus'),
      value: String(props.bonusTickets),
      hint:
        props.topUpYuanPerDraw > 0
          ? t('One extra draw per ¥{{amount}} credited, never expires', {
              amount: props.topUpYuanPerDraw,
            })
          : t('Top-up bonus is turned off'),
      icon: Gift,
      tone: 'chart-4',
    },
    {
      label: t('Current balance'),
      value: formatQuota(props.balanceQuota),
      hint: t('Prizes are credited here instantly'),
      icon: WalletCards,
      tone: 'info',
    },
  ]

  return (
    <StatsStrip>
      {items.map((item) => (
        <StatsCell key={item.label} title={item.hint}>
          <IconBadge tone={item.tone} size='sm'>
            <item.icon />
          </IconBadge>
          <div className='min-w-0 flex-1'>
            <div className='text-muted-foreground/70 truncate text-[11px] font-medium'>
              {item.label}
            </div>
            <div
              className={cn(
                'text-foreground truncate font-mono font-bold tracking-tight tabular-nums',
                // A six-figure balance would be clipped at the regular size,
                // so long values fall back one step instead of truncating.
                item.value.length > 9 ? 'text-sm sm:text-base' : 'text-lg'
              )}
            >
              {item.value}
            </div>
          </div>
        </StatsCell>
      ))}
    </StatsStrip>
  )
}

/** Hairline-separated strip that holds the four headline counters. */
function StatsStrip({ children }: { children: ReactNode }) {
  return (
    <Card className='bg-border/60 grid grid-cols-2 gap-px py-0 sm:grid-cols-4'>
      {children}
    </Card>
  )
}

interface StatsCellProps {
  children: ReactNode
  title?: string
}

function StatsCell({ children, title }: StatsCellProps) {
  return (
    <div
      title={title}
      className='bg-card flex min-w-0 items-center gap-2.5 px-3 py-2.5 sm:px-3.5 sm:py-3'
    >
      {children}
    </div>
  )
}
