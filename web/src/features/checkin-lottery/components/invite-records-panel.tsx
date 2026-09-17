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
import { Check, Clock, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTimestampToDate } from '@/lib/format'

import { useCheckinLotteryReferral } from '../hooks/use-checkin-lottery-referral'

interface InviteRecordsPanelProps {
  /** Only fetch while the invite tab is on screen. */
  enabled: boolean
}

/**
 * Invitee breakdown of the invite-friend program, shown as the third tab of
 * the record page: who signed up with the link, whether their first top-up
 * already paid out and how many tickets that earned.
 */
export function InviteRecordsPanel({ enabled }: InviteRecordsPanelProps) {
  const { t } = useTranslation()
  const { data, invitees, loading } = useCheckinLotteryReferral(enabled)

  if (loading) {
    return (
      <div className='space-y-2 px-4 py-4 sm:px-5'>
        {['1', '2', '3'].map((key) => (
          <Skeleton key={key} className='h-12 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  const summary: { label: string; value: number }[] = [
    { label: t('Invited'), value: data?.invite_count ?? 0 },
    { label: t('Settled'), value: data?.rewarded_count ?? 0 },
    { label: t('Tickets'), value: data?.tickets ?? 0 },
  ]

  return (
    <div>
      <div className='bg-border/60 grid grid-cols-3 gap-px border-b'>
        {summary.map((item) => (
          <div key={item.label} className='bg-card px-4 py-2.5'>
            <div className='text-muted-foreground/70 text-[11px] font-medium'>
              {item.label}
            </div>
            <div className='font-mono text-base font-bold tabular-nums'>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {invitees.length === 0 ? (
        <div className='text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-10 text-center'>
          <UserPlus className='size-5' />
          <p className='text-sm font-medium'>
            {t('No invitees yet, share your link to get started')}
          </p>
        </div>
      ) : (
        <ul className='divide-border/60 divide-y'>
          {invitees.map((invitee) => (
            <li
              key={invitee.user_id}
              className='flex items-center gap-3 px-4 py-2.5 sm:px-5'
            >
              <IconBadge
                tone={invitee.settled ? 'success' : 'neutral'}
                size='sm'
              >
                {invitee.settled ? <Check /> : <Clock />}
              </IconBadge>
              <div className='min-w-0 flex-1'>
                <div className='truncate text-sm font-medium'>
                  {invitee.username}
                </div>
                <div className='text-muted-foreground/70 text-xs'>
                  {t('Registered {{date}}', {
                    date: formatTimestampToDate(invitee.registered_at),
                  })}
                </div>
              </div>
              <div className='shrink-0 text-right'>
                {invitee.settled ? (
                  <>
                    <div className='text-success font-mono text-sm font-semibold tabular-nums'>
                      +{invitee.tickets}
                    </div>
                    <div className='text-muted-foreground/70 text-xs'>
                      {t('First top-up settled')}
                    </div>
                  </>
                ) : (
                  <span className='text-muted-foreground text-xs'>
                    {t('Waiting for the first top-up')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
