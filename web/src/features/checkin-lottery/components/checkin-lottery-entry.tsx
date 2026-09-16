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
import { Gift } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { useCheckinLotteryStatus } from '../hooks/use-checkin-lottery'
import { resolveAvailableDraws } from '../lib/available-draws'

interface CheckinLotteryEntryProps {
  className?: string
}

/**
 * Header entry of the daily draw page. It sits next to the notification
 * bell and carries the number of draws the user can still spend.
 *
 * The count folds in today's unclaimed daily draw, because the draw endpoint
 * claims it lazily: a snapshot taken before the first draw of the day reports
 * zero tickets even though the user can still spin.
 */
export function CheckinLotteryEntry(props: CheckinLotteryEntryProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const user = useAuthStore((state) => state.auth.user)

  const visible = Boolean(status?.checkin_enabled) && Boolean(user)
  const lotteryQuery = useCheckinLotteryStatus(visible)
  const payload = lotteryQuery.data?.data
  const tickets = payload ? resolveAvailableDraws(payload).tickets : 0

  if (!visible) return null

  return (
    <Button
      variant='ghost'
      size='icon'
      className={cn('relative size-9', props.className)}
      aria-label={t('Check-in draw')}
      render={<Link to='/checkin' />}
    >
      <Gift className='size-[1.2rem]' />
      {tickets > 0 ? (
        <Badge className='bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-semibold tabular-nums'>
          {tickets > 99 ? '99+' : tickets}
        </Badge>
      ) : null}
    </Button>
  )
}
