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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  formatUptimePct,
  getSuccessRateDotClass,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { cn } from '@/lib/utils'

import type { ModelPerfBadgeData } from './model-perf-badge'

const STATUS_SLOTS = Array.from({ length: 24 }, (_, slot) => slot)

function isValidRate(rate: number | null | undefined): rate is number {
  return rate != null && Number.isFinite(rate) && rate >= 0 && rate <= 100
}

export interface ModelStatusCellProps {
  perf: ModelPerfBadgeData | undefined
}

/**
 * Compact 24-hour success-rate strip: one small vertical tile per hour,
 * colored by the shared success-rate levels, plus the window average.
 */
export function ModelStatusCell(props: ModelStatusCellProps) {
  const { t } = useTranslation()
  const successRate = props.perf?.success_rate
  const hasSuccessRate = isValidRate(successRate)

  // Hourly points use the server window, including the current partial hour.
  // Hours without traffic stay gray. Slot 23 is the current, partial hour.
  const statusRates = useMemo(() => {
    const windowStart = props.perf?.window_start
    if (windowStart == null) return STATUS_SLOTS.map(() => undefined)
    const ratesByHour = new Map<number, number>()
    for (const point of props.perf?.recent_success_series ?? []) {
      ratesByHour.set(point.ts, point.success_rate)
    }
    return STATUS_SLOTS.map((slot) =>
      ratesByHour.get(windowStart + slot * 3600)
    )
  }, [props.perf?.recent_success_series, props.perf?.window_start])

  const rateLabel = hasSuccessRate
    ? formatUptimePct(successRate)
    : t('No data')

  return (
    <div className='flex min-w-0 items-center gap-2'>
      <span
        role='img'
        aria-label={`${t('Status')}: ${rateLabel}`}
        title={`${t('Status')}: ${rateLabel}`}
        className='flex h-3.5 shrink-0 items-stretch gap-[2px] sm:h-4'
      >
        {STATUS_SLOTS.map((slot) => {
          const rate = statusRates[slot]
          return (
            <span
              key={slot}
              aria-hidden
              data-status-slot={slot}
              className={cn(
                'w-[2px] rounded-[1px] transition-colors duration-300 motion-reduce:transition-none sm:w-[3px]',
                isValidRate(rate)
                  ? getSuccessRateDotClass(rate)
                  : 'bg-muted-foreground/15'
              )}
            />
          )
        })}
      </span>
      <span
        className={cn(
          'font-mono text-[10px] tabular-nums sm:text-xs',
          hasSuccessRate
            ? getSuccessRateTextClass(successRate)
            : 'text-muted-foreground'
        )}
      >
        {hasSuccessRate ? formatUptimePct(successRate) : '—'}
      </span>
    </div>
  )
}
