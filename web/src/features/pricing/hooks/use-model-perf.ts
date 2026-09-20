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
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getPerfMetricsSummary } from '@/features/performance-metrics/api'

import type { ModelPerfBadgeData } from '../components/model-perf-badge'

export const PRICING_PERF_WINDOW_HOURS = 24

const PERF_SUMMARY_QUERY_KEY = ['perf-metrics-summary', PRICING_PERF_WINDOW_HOURS]

function usePerfSummary() {
  return useQuery({
    queryKey: PERF_SUMMARY_QUERY_KEY,
    queryFn: () => getPerfMetricsSummary(PRICING_PERF_WINDOW_HOURS),
    staleTime: 60_000,
  })
}

function toPerfEntry(
  data: ReturnType<typeof usePerfSummary>['data'],
  modelName: string
): ModelPerfBadgeData | undefined {
  if (!modelName) return undefined
  const summary = data?.data
  const model = (summary?.models ?? []).find(
    (entry) => entry.model_name === modelName
  )
  if (!model) return undefined
  return {
    success_rate: model.success_rate,
    avg_latency_ms: model.avg_latency_ms,
    avg_ttft_ms: model.avg_ttft_ms,
    avg_tps: model.avg_tps,
    recent_success_series: model.recent_success_series,
    window_start: summary?.window_start,
  }
}

/**
 * One model's performance window. Table cells call this themselves so the
 * numbers appear as soon as the shared query resolves, even though the table
 * memoizes its rows (a value passed down once would stay stale).
 */
export function useModelPerfEntry(
  modelName: string
): ModelPerfBadgeData | undefined {
  const { data } = usePerfSummary()
  return useMemo(() => toPerfEntry(data, modelName), [data, modelName])
}

/**
 * Per-model success-rate window for the catalog table. The endpoint is public
 * whenever the pricing module is public, and anonymous visitors simply get an
 * empty map (the column then renders the gray "no data" strip).
 */
export function useModelPerf(): Map<string, ModelPerfBadgeData> {
  const { data } = usePerfSummary()

  return useMemo(() => {
    const byModel = new Map<string, ModelPerfBadgeData>()
    const windowStart = data?.data?.window_start
    for (const model of data?.data?.models ?? []) {
      byModel.set(model.model_name, {
        success_rate: model.success_rate,
        avg_latency_ms: model.avg_latency_ms,
        avg_ttft_ms: model.avg_ttft_ms,
        avg_tps: model.avg_tps,
        recent_success_series: model.recent_success_series,
        window_start: windowStart,
      })
    }
    return byModel
  }, [data])
}
