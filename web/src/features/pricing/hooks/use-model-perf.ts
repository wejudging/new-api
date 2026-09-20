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

/**
 * Per-model success-rate window for the catalog table. The endpoint is public
 * whenever the pricing module is public, and anonymous visitors simply get an
 * empty map (the column then renders the gray "no data" strip).
 */
export function useModelPerf(): Map<string, ModelPerfBadgeData> {
  const { data } = useQuery({
    queryKey: ['perf-metrics-summary', PRICING_PERF_WINDOW_HOURS],
    queryFn: () => getPerfMetricsSummary(PRICING_PERF_WINDOW_HOURS),
    staleTime: 60_000,
  })

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
