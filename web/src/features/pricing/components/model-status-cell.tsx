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
  formatLatency,
  formatUptimePct,
  getSuccessRateDotClass,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { cn } from '@/lib/utils'

import { useModelPerfEntry } from '../hooks/use-model-perf'
import type { ModelPerfBadgeData } from './model-perf-badge'

const STATUS_SLOTS = Array.from({ length: 24 }, (_, slot) => slot)

function isValidRate(rate: number | null | undefined): rate is number {
  return rate != null && Number.isFinite(rate) && rate >= 0 && rate <= 100
}

/** Hourly success rates aligned with the server window (gray = no traffic). */
function useStatusRates(perf: ModelPerfBadgeData | undefined) {
  return useMemo(() => {
    const windowStart = perf?.window_start
    if (windowStart == null) return STATUS_SLOTS.map(() => undefined)
    const ratesByHour = new Map<number, number>()
    for (const point of perf?.recent_success_series ?? []) {
      ratesByHour.set(point.ts, point.success_rate)
    }
    return STATUS_SLOTS.map((slot) =>
      ratesByHour.get(windowStart + slot * 3600)
    )
  }, [perf?.recent_success_series, perf?.window_start])
}

export interface ModelMetricCellProps {
  /** Model whose performance window is shown. */
  modelName?: string
  /** Explicit window (previews and tests); wins over the shared query. */
  perf?: ModelPerfBadgeData
}

/**
 * The table memoizes its rows, so a window handed down as a prop would stay
 * stale until the rows change. Each cell subscribes to the shared summary
 * query instead, and re-renders on its own once the numbers arrive.
 */
function usePerf(props: ModelMetricCellProps): ModelPerfBadgeData | undefined {
  const queried = useModelPerfEntry(props.modelName ?? '')
  return props.perf ?? queried
}

/** Throughput column: average output tokens per second. */
export function ModelTpsCell(props: ModelMetricCellProps) {
  const tps = usePerf(props)?.avg_tps
  const hasTps = tps != null && Number.isFinite(tps) && tps > 0
  return (
    <span className='font-mono text-xs tabular-nums'>
      {hasTps ? `${tps.toFixed(1)}t/s` : '—'}
    </span>
  )
}

/** First-token column: average TTFT of the same window. */
export function ModelTtftCell(props: ModelMetricCellProps) {
  const ttft = usePerf(props)?.avg_ttft_ms
  const hasTtft = ttft != null && Number.isFinite(ttft) && ttft > 0
  return (
    <span className='font-mono text-xs tabular-nums'>
      {hasTtft ? formatLatency(ttft) : '—'}
    </span>
  )
}

/** Success-rate column: 24-hour strip plus the window average. */
export function ModelSuccessCell(props: ModelMetricCellProps) {
  const { t } = useTranslation()
  const perf = usePerf(props)
  const successRate = perf?.success_rate
  const hasSuccessRate = isValidRate(successRate)
  const statusRates = useStatusRates(perf)
  const rateLabel = hasSuccessRate ? formatUptimePct(successRate) : t('No data')

  return (
    <span className='flex min-w-0 items-center gap-1.5'>
      <span
        role='img'
        aria-label={`${t('Success rate')}: ${rateLabel}`}
        title={`${t('Success rate')}: ${rateLabel}`}
        className='flex h-3 shrink-0 items-stretch gap-[2px]'
      >
        {STATUS_SLOTS.map((slot) => {
          const rate = statusRates[slot]
          return (
            <span
              key={slot}
              aria-hidden
              data-status-slot={slot}
              className={cn(
                'w-[2px] rounded-[1px] transition-colors duration-300 motion-reduce:transition-none',
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
          'font-mono text-xs leading-none tabular-nums',
          hasSuccessRate
            ? getSuccessRateTextClass(successRate)
            : 'text-muted-foreground'
        )}
      >
        {hasSuccessRate ? formatUptimePct(successRate) : '—'}
      </span>
    </span>
  )
}
