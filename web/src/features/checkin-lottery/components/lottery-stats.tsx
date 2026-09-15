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
import { CalendarCheck, Sparkles, Ticket, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

interface LotteryStatsProps {
  tickets: number
  dailyDraws: number
  checkedInToday: boolean
  balanceQuota: number
  loading?: boolean
}

/**
 * The four headline numbers of the draw page: available tickets, whether
 * today's ticket has been claimed, how many tickets a check-in grants and
 * the current balance the prizes are paid into.
 */
export function LotteryStats(props: LotteryStatsProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
        {['tickets', 'today', 'daily', 'balance'].map((key) => (
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
      hint: t('Tickets you can use right now'),
      icon: Ticket,
      tone: 'primary',
    },
    {
      label: t('Today’s claim'),
      value: props.checkedInToday ? t('Claimed') : t('Not claimed yet'),
      hint: props.checkedInToday
        ? t('Come back tomorrow for more')
        : t('Draw once to claim today’s tickets'),
      icon: CalendarCheck,
      tone: props.checkedInToday ? 'success' : 'warning',
    },
    {
      label: t('Draws per day'),
      value: `+${props.dailyDraws}`,
      hint: t('Tickets granted by one check-in'),
      icon: Sparkles,
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
