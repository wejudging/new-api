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
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

interface LotteryStatsProps {
  tickets: number
  /** Daily tickets left today, capped by `dailyDraws`. */
  dailyTickets: number
  /** Permanent tickets earned from top-ups. */
  bonusTickets: number
  dailyDraws: number
  /** Credited CNY that grants one extra ticket, `0` disables the bonus. */
  topUpYuanPerDraw: number
  balanceQuota: number
  loading?: boolean
}

/**
 * The four headline numbers of the draw page: total tickets, the daily
 * bucket (never accumulates), the permanent top-up bucket and the current
 * balance the prizes are paid into.
 */
export function LotteryStats(props: LotteryStatsProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
        {['tickets', 'daily', 'bonus', 'balance'].map((key) => (
          <Card key={key} className='gap-2 px-4 py-3.5'>
            <Skeleton className='h-8 w-8 rounded-lg' />
            <Skeleton className='h-6 w-16' />
            <Skeleton className='h-3.5 w-24' />
          </Card>
        ))}
      </div>
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
      value: `${props.dailyTickets}/${props.dailyDraws}`,
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
    <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
      {items.map((item) => (
        <Card key={item.label} className='gap-2 px-4 py-3.5'>
          <IconBadge tone={item.tone} size='lg'>
            <item.icon />
          </IconBadge>
          <div className='text-foreground truncate font-mono text-xl font-bold tracking-tight tabular-nums sm:text-2xl'>
            {item.value}
          </div>
          <div className='min-w-0'>
            <div className='truncate text-xs font-medium'>{item.label}</div>
            <div className='text-muted-foreground/70 mt-0.5 line-clamp-2 text-xs'>
              {item.hint}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
