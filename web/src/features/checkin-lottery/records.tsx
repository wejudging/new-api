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
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Coins,
  History,
  Receipt,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStatus } from '@/hooks/use-status'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { LotteryUnavailableCard } from './components/lottery-unavailable-card'
import {
  useCheckinLotteryDrawRecords,
  useCheckinLotteryTicketRecords,
} from './hooks/use-checkin-lottery-records'
import { formatYuan } from './lib/format'
import type {
  CheckinLotteryDrawRecord,
  CheckinLotteryTicketRecord,
  CheckinLotteryTicketReason,
} from './types'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

/** i18n keys for the page-size picker, kept literal so they can be extracted. */
const PAGE_SIZE_KEYS: Record<number, string> = {
  10: '10 / page',
  20: '20 / page',
  50: '50 / page',
  100: '100 / page',
}

/**
 * Personal draw history: the prizes that were paid out and the ticket ledger
 * behind them. Reachable from the daily draw page and the header entry.
 */
export function CheckinLotteryRecords() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const enabled = Boolean(status?.checkin_enabled)

  const [tab, setTab] = useState<'draw' | 'ticket'>('draw')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)

  const draws = useCheckinLotteryDrawRecords({ page, pageSize })
  const tickets = useCheckinLotteryTicketRecords({ page, pageSize })
  const active = tab === 'draw' ? draws : tickets

  const totalPages = Math.max(1, Math.ceil(active.total / pageSize))

  function handleTabChange(next: string) {
    setTab(next === 'ticket' ? 'ticket' : 'draw')
    setPage(1)
  }

  function handlePageSizeChange(next: number) {
    setPageSize(next)
    setPage(1)
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='block truncate'>{t('Draw records')}</span>
        <span className='text-muted-foreground block truncate text-xs font-normal'>
          {t('Every prize you won and every ticket you spent')}
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button variant='outline' size='sm' render={<Link to='/checkin' />}>
          <ArrowLeft className='size-4' />
          {t('Back to daily draw')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-5'>
          {!enabled ? (
            <LotteryUnavailableCard />
          ) : (
            <Card className='gap-0 py-0'>
              <div className='flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5'>
                <Tabs value={tab} onValueChange={handleTabChange}>
                  <TabsList>
                    <TabsTrigger value='draw'>
                      <Sparkles className='size-4' />
                      {t('Prize records')}
                    </TabsTrigger>
                    <TabsTrigger value='ticket'>
                      <Coins className='size-4' />
                      {t('Ticket history')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <Select
                  items={PAGE_SIZE_OPTIONS.map((size) => ({
                    value: String(size),
                    label: t(PAGE_SIZE_KEYS[size]),
                  }))}
                  value={String(pageSize)}
                  onValueChange={(value) =>
                    value !== null && handlePageSizeChange(Number(value))
                  }
                >
                  <SelectTrigger className='h-8 w-[104px]'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {t(PAGE_SIZE_KEYS[size])}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <CardContent className='px-0 pb-0'>
                <RecordsListBody
                  tab={tab}
                  loading={active.loading}
                  hasItems={active.items.length > 0}
                  drawItems={draws.items}
                  ticketItems={tickets.items}
                />

                {!active.loading && active.total > 0 ? (
                  <div className='flex flex-col items-center gap-3 border-t px-4 py-3 sm:flex-row sm:justify-between sm:px-5'>
                    <div className='text-muted-foreground text-xs sm:text-sm'>
                      {t('Showing')} {(page - 1) * pageSize + 1}-
                      {Math.min(page * pageSize, active.total)} {t('of')}{' '}
                      {active.total}
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-8 w-8 p-0'
                        aria-label={t('Previous page')}
                        onClick={() => setPage((current) => current - 1)}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                        <span className='font-medium'>{page}</span>
                        <span>/</span>
                        <span>{totalPages}</span>
                      </div>
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-8 w-8 p-0'
                        aria-label={t('Next page')}
                        onClick={() => setPage((current) => current + 1)}
                        disabled={page >= totalPages}
                      >
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

interface RecordsListBodyProps {
  tab: 'draw' | 'ticket'
  loading: boolean
  hasItems: boolean
  drawItems: CheckinLotteryDrawRecord[]
  ticketItems: CheckinLotteryTicketRecord[]
}

function RecordsListBody(props: RecordsListBodyProps) {
  if (props.loading) {
    return (
      <div className='space-y-2 px-4 py-4 sm:px-5'>
        {['1', '2', '3', '4', '5'].map((key) => (
          <Skeleton key={key} className='h-12 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  if (!props.hasItems) {
    return <RecordsEmptyState tab={props.tab} />
  }

  if (props.tab === 'draw') {
    return <DrawRecordsList items={props.drawItems} />
  }

  return <TicketRecordsList items={props.ticketItems} />
}

function RecordsEmptyState({ tab }: { tab: 'draw' | 'ticket' }) {
  const { t } = useTranslation()

  return (
    <div className='text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-10 text-center'>
      <History className='size-5' />
      <p className='text-sm font-medium'>
        {tab === 'draw'
          ? t('No prize records yet')
          : t('No ticket history yet')}
      </p>
      <p className='text-xs'>{t('Draw once and your history shows up here')}</p>
    </div>
  )
}

function DrawRecordsList({ items }: { items: CheckinLotteryDrawRecord[] }) {
  const { t } = useTranslation()

  return (
    <ul className='divide-border/60 divide-y'>
      {items.map((record) => (
        <li
          key={record.id}
          className='flex items-center gap-3 px-4 py-3 sm:px-5'
        >
          <div className='bg-success/10 text-success flex size-9 shrink-0 items-center justify-center rounded-lg'>
            <Receipt className='size-4' />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='truncate text-sm font-medium'>
              {t('Prize paid out')}
            </div>
            <div className='text-muted-foreground/70 text-xs'>
              {formatTimestampToDate(record.created_at)}
            </div>
          </div>
          <div className='shrink-0 text-right'>
            <div className='text-success font-mono text-sm font-bold tabular-nums sm:text-base'>
              {formatYuan(record.amount)}
            </div>
            <div className='text-muted-foreground/70 text-xs tabular-nums'>
              {formatQuota(record.quota)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

const REASON_LABELS: Record<CheckinLotteryTicketReason, string> = {
  claim: 'Daily check-in',
  draw: 'Lottery draw',
  refund: 'Refund',
  topup: 'Top-up bonus',
}

function TicketRecordsList({ items }: { items: CheckinLotteryTicketRecord[] }) {
  const { t } = useTranslation()

  return (
    <ul className='divide-border/60 divide-y'>
      {items.map((record) => {
        const granted = record.delta >= 0
        return (
          <li
            key={record.id}
            className='flex items-center gap-3 px-4 py-3 sm:px-5'
          >
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                granted
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Coins className='size-4' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='truncate text-sm font-medium'>
                {t(REASON_LABELS[record.reason] ?? 'Lottery draw')}
              </div>
              <div className='text-muted-foreground/70 text-xs'>
                {formatTimestampToDate(record.created_at)}
              </div>
            </div>
            <div
              className={cn(
                'shrink-0 font-mono text-sm font-bold tabular-nums sm:text-base',
                granted ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {granted ? `+${record.delta}` : String(record.delta)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
