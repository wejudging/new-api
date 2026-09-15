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
import { CalendarX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'

/** Shown when the administrator has not enabled the check-in lottery. */
export function LotteryUnavailableCard() {
  const { t } = useTranslation()

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
