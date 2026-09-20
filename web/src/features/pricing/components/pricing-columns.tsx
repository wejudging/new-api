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
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableColumnHeader } from '@/components/data-table'
import { getLobeIcon } from '@/lib/lobe-icon'

import type { PricingModel } from '../types'
import { CachedPriceCell } from './cached-price-cell'
import { CatalogPriceCell } from './catalog-price-cell'
import type { ModelPerfBadgeData } from './model-perf-badge'
import type { ModelPriceCellOptions } from './model-price-cell'
import { ModelStatusCell } from './model-status-cell'

// ----------------------------------------------------------------------------
// Pricing Table Columns
//
// Six columns, mirroring the reference catalog:
// 模型 · 提供商 · 输入价格 · 输出价格 · 缓存价格 · 健康
// ----------------------------------------------------------------------------

export type PricingColumnsOptions = ModelPriceCellOptions & {
  /** Recent success-rate window per model, keyed by model name. */
  perfByModel?: Map<string, ModelPerfBadgeData>
}

export function usePricingColumns(
  options: PricingColumnsOptions = {}
): ColumnDef<PricingModel>[] {
  const { t } = useTranslation()

  return [
    // 模型
    {
      accessorKey: 'model_name',
      meta: { label: t('Model') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Model')} />
      ),
      cell: ({ row }) => {
        const model = row.original

        return (
          <span className='block truncate font-mono text-sm font-semibold tracking-[-0.01em]'>
            {model.model_name}
          </span>
        )
      },
      minSize: 220,
    },

    // 提供商
    {
      accessorKey: 'vendor_name',
      header: t('Provider'),
      cell: ({ row }) => {
        const model = row.original
        const vendorIconKey = model.vendor_icon || model.icon
        const vendorIcon = vendorIconKey ? getLobeIcon(vendorIconKey, 16) : null

        return (
          <div className='flex min-w-0 items-center gap-2'>
            <span className='border-border/60 bg-muted/40 flex size-7 shrink-0 items-center justify-center rounded-lg border'>
              {vendorIcon ?? (
                <span className='text-muted-foreground text-xs'>—</span>
              )}
            </span>
            <span className='truncate text-sm'>
              {model.vendor_name || (
                <span className='text-muted-foreground/50'>—</span>
              )}
            </span>
          </div>
        )
      },
      size: 160,
      enableSorting: false,
    },

    // 输入价格
    {
      id: 'input_price',
      header: t('Input price'),
      cell: ({ row }) => (
        <CatalogPriceCell
          model={row.original}
          kind='input'
          options={options}
        />
      ),
      size: 150,
      enableSorting: false,
    },

    // 输出价格
    {
      id: 'output_price',
      header: t('Output price'),
      cell: ({ row }) => (
        <CatalogPriceCell
          model={row.original}
          kind='output'
          options={options}
        />
      ),
      size: 150,
      enableSorting: false,
    },

    // 缓存价格
    {
      id: 'cached_price',
      header: t('Cache price'),
      cell: ({ row }) => (
        <CachedPriceCell model={row.original} options={options} />
      ),
      size: 150,
      enableSorting: false,
    },

    // 健康
    {
      id: 'health',
      header: t('Health'),
      cell: ({ row }) => (
        <div className='flex min-w-0 items-center justify-between gap-3'>
          <ModelStatusCell
            perf={options.perfByModel?.get(row.original.model_name)}
          />
          <ChevronRight
            aria-hidden
            className='text-muted-foreground size-4 shrink-0'
          />
        </div>
      ),
      size: 220,
      enableSorting: false,
    },
  ]
}
