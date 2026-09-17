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
import { Check, ListChecks, Ticket, UserPlus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import type { CheckinLotteryReferral } from '../types'

interface InviteFriendsCardProps {
  referral?: CheckinLotteryReferral
}

/**
 * Invite-friend program of the draw page.
 *
 * The card is deliberately short — three rows: the title with its three
 * counters, the link with its copy button and a single line stating the
 * payout. The invitee breakdown lives on the record page next to the prize
 * records, so this card keeps no dialog of its own.
 */
export function InviteFriendsCard({ referral }: InviteFriendsCardProps) {
  const { t } = useTranslation()

  const affCode = referral?.aff_code ?? ''
  const inviteLink = affCode
    ? `${window.location.origin}/sign-up?aff=${affCode}`
    : ''

  const stats: {
    label: string
    title: string
    value: number
    icon: typeof Users
  }[] = [
    {
      label: t('Invited'),
      title: t('Invited friends'),
      value: referral?.invite_count ?? 0,
      icon: Users,
    },
    {
      label: t('Settled'),
      title: t('Settled invites'),
      value: referral?.rewarded_count ?? 0,
      icon: Check,
    },
    {
      label: t('Tickets'),
      title: t('Tickets earned'),
      value: referral?.tickets ?? 0,
      icon: Ticket,
    },
  ]

  return (
    <Card className='gap-0 py-0'>
      <CardContent className='space-y-2.5 px-4 py-3 sm:px-5 sm:py-3.5'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-2'>
          <div className='flex min-w-0 items-center gap-2'>
            <UserPlus className='text-primary size-4 shrink-0' />
            <span className='text-sm font-semibold'>{t('Invite friends')}</span>
          </div>

          <div className='ms-auto flex items-center gap-3'>
            {stats.map((item) => (
              <span
                key={item.label}
                title={item.title}
                className='flex items-center gap-1'
              >
                <item.icon className='text-muted-foreground/50 size-3.5' />
                <span className='text-muted-foreground/70 text-[11px]'>
                  {item.label}
                </span>
                <span className='font-mono text-sm font-semibold tabular-nums'>
                  {item.value}
                </span>
              </span>
            ))}
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground h-7 gap-1 px-1.5 text-xs'
              render={<Link to='/checkin/records' search={{ tab: 'invite' }} />}
            >
              <ListChecks className='size-3.5' />
              {t('My records')}
            </Button>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Input
            value={inviteLink}
            readOnly
            placeholder={t('Invite link is unavailable right now')}
            className='border-muted bg-background/70 h-8 min-w-0 flex-1 font-mono text-xs'
            onFocus={(event) => event.currentTarget.select()}
          />
          {inviteLink ? (
            <CopyButton
              value={inviteLink}
              variant='outline'
              className='bg-background size-8'
              iconClassName='size-3.5'
              tooltip={t('Copy invite link')}
              aria-label={t('Copy invite link')}
            />
          ) : null}
        </div>

        <p className='text-muted-foreground/70 text-[11px] leading-relaxed'>
          {buildRuleText(t, referral)}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Rule line under the invite link, adapted to the configured payout.
 *
 * The step payout is asymmetric on purpose: the inviter earns one ticket per
 * step, while the invited friend earns two — one from this program and one from
 * the top-up bonus they keep — so the line has to name both numbers.
 *
 * The trailing note carries the two terms a reader cannot infer (first top-up
 * only, credited amount), which keeps the card at a single line of fine print.
 */
function buildRuleText(
  t: (key: string, options?: Record<string, unknown>) => string,
  referral?: CheckinLotteryReferral
): string {
  const base = referral?.base_tickets ?? 0
  const step = referral?.step_yuan ?? 0

  if (!referral?.enabled) {
    return t('Invite rewards are turned off right now.')
  }

  const payout = payoutText(t, base, step)
  if (!payout) return t('Invite rewards are turned off right now.')

  return `${payout} · ${t(
    'Paid once on the first top-up, on the credited amount; your friend also keeps the top-up bonus.'
  )}`
}

/** Payout sentence for the configured base and step tickets. */
function payoutText(
  t: (key: string, options?: Record<string, unknown>) => string,
  base: number,
  step: number
): string {
  if (step > 0 && base > 0) {
    return t(
      'Every ¥{{step}} your friend tops up pays you 1 ticket and your friend 2, plus {{base}} ticket(s) each.',
      { step, base }
    )
  }
  if (step > 0) {
    return t(
      'Every ¥{{step}} your friend tops up pays you 1 ticket and your friend 2.',
      { step }
    )
  }
  if (base > 0) {
    return t(
      "Your friend's first top-up pays {{base}} ticket(s) to both of you.",
      { base }
    )
  }
  return ''
}
