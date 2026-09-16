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
import { CalendarX, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/** Why the daily draw cannot be played right now. */
export type LotteryUnavailableReason = 'disabled' | 'topup-required'

interface LotteryUnavailableCardProps {
  reason?: LotteryUnavailableReason
}

/**
 * Shown when the daily draw cannot be played: either the administrator has not
 * enabled it, or the account has to top up once before joining.
 */
export function LotteryUnavailableCard(props: LotteryUnavailableCardProps) {
  const { t } = useTranslation()

  if (props.reason === 'topup-required') {
    return (
      <Card className='gap-2 px-6 py-10'>
        <div className='flex flex-col items-center gap-2 text-center'>
          <WalletCards className='text-muted-foreground size-6' />
          <p className='text-sm font-semibold'>
            {t('Top up to join the daily draw')}
          </p>
          <p className='text-muted-foreground max-w-md text-xs'>
            {t(
              'The daily draw is only open to accounts with a top-up on record, so freshly registered accounts cannot farm it. Top up any amount and come back to spin.'
            )}
          </p>
          <Button className='mt-2' size='sm' render={<Link to='/wallet' />}>
            <WalletCards className='size-4' />
            {t('Top up now')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className='gap-2 px-6 py-10'>
      <div className='flex flex-col items-center gap-2 text-center'>
        <CalendarX className='text-muted-foreground size-6' />
        <p className='text-sm font-semibold'>
          {t('Daily draw is not available right now')}
        </p>
        <p className='text-muted-foreground max-w-md text-xs'>
          {t(
            'The administrator has not enabled the check-in lottery yet. Please come back later.'
          )}
        </p>
      </div>
    </Card>
  )
}
