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
import { CircleAlert, Dices, PartyPopper } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { useCheckinDraw } from '../hooks/use-checkin-draw'
import { formatYuan } from '../lib/format'
import type { CheckinLotteryDrawResult, CheckinLotteryPrize } from '../types'
import { ConfettiBurst } from './confetti-burst'
import { PrizeBoard } from './prize-board'

interface LotteryDrawCardProps {
  prizes: CheckinLotteryPrize[]
  tickets: number
  checkedInToday: boolean
  onDrawComplete?: (result: CheckinLotteryDrawResult) => void
}

/**
 * The draw itself: prize pool, the single "check-in draw" action, the
 * revealed result and the Turnstile handshake when the site requires it.
 */
export function LotteryDrawCard(props: LotteryDrawCardProps) {
  const { t } = useTranslation()
  const drawState = useCheckinDraw({
    prizes: props.prizes,
    onSuccess: props.onDrawComplete,
  })

  const canClaimToday = !props.checkedInToday
  const hasTicket = props.tickets > 0
  const isExhausted = !hasTicket && !canClaimToday
  const disabled = drawState.drawing || props.prizes.length === 0
  const buttonDisabled = disabled || isExhausted

  let hint = t('Draw once to claim today’s tickets')
  if (isExhausted) {
    hint = t('No draws left today, come back tomorrow')
  } else if (hasTicket) {
    hint = t('Available draws: {{tickets}}', { tickets: props.tickets })
  }

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='border-b px-4 py-3.5 sm:px-5'>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <Dices className='text-primary size-4' />
          {t('Prize pool')}
        </CardTitle>
        <CardDescription className='text-xs'>
          {t(
            'Every draw uses one ticket and the prize is credited to your balance instantly'
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-4 px-4 py-4 sm:px-5 sm:py-5'>
        <div className='relative'>
          <div
            aria-hidden='true'
            className='checkin-board-sheen pointer-events-none absolute -inset-x-2 -inset-y-1 overflow-hidden rounded-2xl'
          />
          <PrizeBoard
            prizes={props.prizes}
            rollingIndex={drawState.rollingIndex}
            wonIndex={drawState.wonIndex}
            disabled={drawState.drawing}
          />
          {drawState.wonIndex != null ? (
            <ConfettiBurst
              seed={Math.round((drawState.result?.amount ?? 0) * 1000)}
            />
          ) : null}
        </div>

        {drawState.result ? (
          <div className='checkin-result-shine border-success/40 from-success/15 via-success/10 to-success/5 text-success animate-in fade-in slide-in-from-bottom-2 relative flex flex-wrap items-center justify-center gap-x-2 gap-y-1 overflow-hidden rounded-xl border bg-gradient-to-r px-4 py-3 text-sm font-medium duration-300'>
            <PartyPopper className='checkin-result-pop size-4' />
            <span>{t('Draw result')}</span>
            <span className='text-muted-foreground/60'>·</span>
            <span>
              {t('This round: {{amount}}', {
                amount: formatYuan(drawState.result.amount),
              })}
            </span>
          </div>
        ) : null}

        {drawState.errorMessage ? (
          <div className='border-destructive/40 bg-destructive/10 text-destructive flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-sm font-medium'>
            <CircleAlert className='size-4' />
            <span>{drawState.errorMessage}</span>
          </div>
        ) : null}

        <div className='flex flex-col items-center gap-2'>
          <Button
            size='lg'
            className={cn('h-10 w-full max-w-xs text-sm font-semibold')}
            disabled={buttonDisabled}
            onClick={() => {
              drawState.resetResult()
              void drawState.draw()
            }}
          >
            <Dices className='size-4' />
            {drawState.drawing ? t('Drawing…') : t('Check-in draw')}
          </Button>
          <p className='text-muted-foreground/70 text-center text-xs'>{hint}</p>
        </div>
      </CardContent>

      <Dialog
        open={drawState.turnstileOpen}
        onOpenChange={drawState.setTurnstileOpen}
        title={t('Verification required')}
        description={t('Complete the challenge to continue')}
        contentClassName='sm:max-w-md'
      >
        <div className='flex justify-center py-2'>
          {drawState.turnstileSiteKey ? (
            <Turnstile
              key={drawState.turnstileWidgetKey}
              siteKey={drawState.turnstileSiteKey}
              onVerify={(token) => void drawState.draw(token)}
            />
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('Turnstile is enabled but site key is empty.')}
            </p>
          )}
        </div>
      </Dialog>
    </Card>
  )
}
