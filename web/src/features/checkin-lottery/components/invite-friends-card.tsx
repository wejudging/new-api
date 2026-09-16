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
import { Check, Clock, ListChecks, Ticket, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTimestampToDate } from '@/lib/format'

import { useCheckinLotteryReferral } from '../hooks/use-checkin-lottery-referral'
import type { CheckinLotteryReferral } from '../types'

interface InviteFriendsCardProps {
  referral?: CheckinLotteryReferral
}

/**
 * Invite-friend program of the draw page, sitting next to the top-up bonus:
 * sharing the link brings a friend in, their first top-up pays draw tickets to
 * both sides and every settled invitee shows up in the records dialog.
 */
export function InviteFriendsCard({ referral }: InviteFriendsCardProps) {
  const { t } = useTranslation()
  const [recordsOpen, setRecordsOpen] = useState(false)

  const affCode = referral?.aff_code ?? ''
  const inviteLink = affCode
    ? `${window.location.origin}/sign-up?aff=${affCode}`
    : ''

  const stats: {
    label: string
    value: string
    icon: typeof Users
    tone: IconBadgeTone
  }[] = [
    {
      label: t('Invited friends'),
      value: String(referral?.invite_count ?? 0),
      icon: Users,
      tone: 'chart-3',
    },
    {
      label: t('Settled invites'),
      value: String(referral?.rewarded_count ?? 0),
      icon: Check,
      tone: 'success',
    },
    {
      label: t('Tickets earned'),
      value: String(referral?.tickets ?? 0),
      icon: Ticket,
      tone: 'primary',
    },
  ]

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='border-b px-4 py-3.5 sm:px-5'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='min-w-0'>
            <CardTitle className='flex items-center gap-2 text-sm'>
              <UserPlus className='text-primary size-4' />
              {t('Invite friends')}
            </CardTitle>
            <CardDescription className='text-xs'>
              {t(
                'Invite a friend: after their first top-up you both receive draw tickets'
              )}
            </CardDescription>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setRecordsOpen(true)}
          >
            <ListChecks className='size-4' />
            {t('Invite records')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className='grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(240px,1.25fr)_minmax(240px,1fr)] lg:items-center'>
        <div className='min-w-0 space-y-2'>
          <div className='text-muted-foreground text-xs font-medium'>
            {t('Invite link')}
          </div>
          <div className='flex items-center gap-2'>
            <Input
              value={inviteLink}
              readOnly
              placeholder={t('Invite link is unavailable right now')}
              className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
              onFocus={(event) => event.currentTarget.select()}
            />
            {inviteLink ? (
              <CopyButton
                value={inviteLink}
                variant='outline'
                className='bg-background size-9'
                iconClassName='size-4'
                tooltip={t('Copy invite link')}
                aria-label={t('Copy invite link')}
              />
            ) : null}
          </div>
          <p className='text-muted-foreground/70 text-xs'>
            {buildRuleText(t, referral)}
          </p>
        </div>

        <div className='grid grid-cols-3 gap-2 text-center'>
          {stats.map((item) => (
            <div key={item.label} className='min-w-0 space-y-1'>
              <IconBadge tone={item.tone} size='sm' className='mx-auto'>
                <item.icon />
              </IconBadge>
              <div className='truncate font-mono text-base font-bold tabular-nums'>
                {item.value}
              </div>
              <div className='text-muted-foreground truncate text-[11px] font-medium'>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog
        open={recordsOpen}
        onOpenChange={setRecordsOpen}
        title={t('Invite records')}
        description={t(
          'The friends who signed up with your link and what their first top-up paid out'
        )}
        contentClassName='sm:max-w-xl'
      >
        <InviteeList open={recordsOpen} />
      </Dialog>
    </Card>
  )
}

/** Rule line under the invite link, adapted to the configured payout. */
function buildRuleText(
  t: (key: string, options?: Record<string, unknown>) => string,
  referral?: CheckinLotteryReferral
): string {
  const base = referral?.base_tickets ?? 0
  const step = referral?.step_yuan ?? 0

  if (!referral?.enabled) {
    return t('Invite rewards are turned off right now.')
  }
  if (step > 0 && base > 0) {
    return t(
      "Every ¥{{step}} of your friend's first top-up pays one ticket to both of you, with at least {{base}} each. The credited amount counts, so a discounted top-up qualifies.",
      { step, base }
    )
  }
  if (step > 0) {
    return t(
      "Every ¥{{step}} of your friend's first top-up pays one ticket to both of you. The credited amount counts, so a discounted top-up qualifies.",
      { step }
    )
  }
  if (base > 0) {
    return t(
      "Your friend's first top-up pays {{base}} ticket(s) to both of you.",
      { base }
    )
  }
  return t('Invite rewards are turned off right now.')
}

/** Invitee breakdown, fetched only while the dialog is open. */
function InviteeList({ open }: { open: boolean }) {
  const { t } = useTranslation()
  const { invitees, loading } = useCheckinLotteryReferral(open)

  if (loading) {
    return (
      <div className='space-y-2'>
        {['1', '2', '3'].map((key) => (
          <Skeleton key={key} className='h-12 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  if (invitees.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm'>
        <UserPlus className='size-5' />
        {t('No invitees yet, share your link to get started')}
      </div>
    )
  }

  return (
    <ul className='divide-border/60 divide-y'>
      {invitees.map((invitee) => (
        <li key={invitee.user_id} className='flex items-center gap-3 py-2.5'>
          <IconBadge tone={invitee.settled ? 'success' : 'neutral'} size='sm'>
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
  )
}
