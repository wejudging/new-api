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
import type { Row, PaginationState } from '@tanstack/react-table'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePagination,
  DataTableRow,
  DataTableView,
  MobileCardList,
  useDataTable,
} from '@/components/data-table'
import { useMediaQuery } from '@/hooks/use-media-query'

import { DEFAULT_PRICING_PAGE_SIZE, DEFAULT_TOKEN_UNIT } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { usePricingColumns } from './pricing-columns'
import { cn } from '@/lib/utils'
export interface PricingTableProps {
  models: PricingModel[]
  isLoading?: boolean
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  onModelClick?: (modelName: string) => void
}

export function PricingTable(props: PricingTableProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const {
    models,
    isLoading = false,
    priceRate = 1,
    usdExchangeRate = 1,
    tokenUnit = DEFAULT_TOKEN_UNIT,
    showRechargePrice = false,
    selectedGroup,
    onModelClick,
  } = props

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PRICING_PAGE_SIZE,
  })

  const columns = usePricingColumns({
    tokenUnit,
    priceRate,
    usdExchangeRate,
    showRechargePrice,
    selectedGroup,
    onModelClick,
  })

  const { table } = useDataTable({
    data: models,
    columns,
    pageCount: Math.ceil(models.length / pagination.pageSize),
    pagination,
    onPaginationChange: setPagination,
    manualPagination: false,
    withFilteredRowModel: false,
    withSortedRowModel: false,
    withFacetedRowModel: false,
  })

  const handleRowClick = useCallback(
    (model: PricingModel) => {
      onModelClick?.(model.model_name)
    },
    [onModelClick]
  )

  return (
    <div className='space-y-4'>
      {isMobile ? (
        <MobileCardList
          table={table}
          isLoading={isLoading}
          emptyTitle={t('No Models Found')}
          emptyDescription={t('No models match your current filters.')}
        />
      ) : (
        <DataTableView
          table={table}
          isLoading={isLoading}
          emptyTitle={t('No Models Found')}
          emptyDescription={t('No models match your current filters.')}
          skeletonKeyPrefix='pricing-skeleton'
          applyHeaderSize
          getColumnClassName={(columnId, kind) => {
            const header = kind === 'header' ? 'text-muted-foreground font-medium' : ''
            // 数字列按内容收紧（w-px = 最小宽度），成功率列独占剩余宽度，
            // 这样窗口变宽时是成功率条变长，而不是数字之间被拉开。
            if (
              columnId === 'input_price' ||
              columnId === 'output_price' ||
              columnId === 'cached_price' ||
              columnId === 'tps' ||
              columnId === 'ttft'
            ) {
              return cn(header, 'w-px whitespace-nowrap text-right tabular-nums')
            }
            if (columnId === 'success_rate') {
              return cn(header, 'w-full')
            }
            return header || undefined
          }}
          renderRow={(row: Row<PricingModel>) => (
            <DataTableRow
              key={row.id}
              row={row}
              className='hover:bg-muted/30 cursor-pointer transition-colors'
              onClick={() => handleRowClick(row.original)}
            />
          )}
        />
      )}

      {!isLoading && models.length > 0 && <DataTablePagination table={table} />}
    </div>
  )
}
