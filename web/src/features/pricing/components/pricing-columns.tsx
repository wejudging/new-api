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
import { ChevronRight, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon, resolveVendorIconId } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import type { PricingModel } from '../types'
import { CachedPriceCell } from './cached-price-cell'
import { CatalogPriceCell } from './catalog-price-cell'
import type { ModelPriceCellOptions } from './model-price-cell'
import {
  ModelSuccessCell,
  ModelTpsCell,
  ModelTtftCell,
} from './model-status-cell'

// ----------------------------------------------------------------------------
// Pricing Table Columns
//
// 提供商 · 模型 · 输入 · 输出 · 缓存 · 健康
// ----------------------------------------------------------------------------

export type PricingColumnsOptions = ModelPriceCellOptions & {
  /** Opens the model details drawer (used by the mobile card list). */
  onModelClick?: (modelName: string) => void
}

export function usePricingColumns(
  options: PricingColumnsOptions = {}
): ColumnDef<PricingModel>[] {
  const { t } = useTranslation()

  return [
    // 提供商
    {
      accessorKey: 'vendor_name',
      meta: { label: t('Provider') },
      header: t('Provider'),
      cell: ({ row }) => {
        const model = row.original
        const vendorIconKey =
          model.vendor_icon ||
          model.icon ||
          resolveVendorIconId(model.vendor_name)
        const vendorIcon = vendorIconKey ? getLobeIcon(vendorIconKey, 16) : null

        return (
          <div className='flex min-w-0 items-center gap-2'>
            <span className='border-border/60 bg-muted/40 flex size-6 shrink-0 items-center justify-center rounded-md border sm:size-7 sm:rounded-lg'>
              {vendorIcon ?? (
                // Custom vendors start without an icon; keep the tile aligned
                // with a neutral mark instead of an empty box.
                <Store
                  aria-hidden
                  className='text-muted-foreground size-3.5'
                />
              )}
            </span>
            <span className='truncate text-xs sm:text-sm'>
              {model.vendor_name || (
                <span className='text-muted-foreground/50'>—</span>
              )}
            </span>
          </div>
        )
      },
      size: 136,
      enableSorting: false,
    },

    // 模型
    {
      accessorKey: 'model_name',
      meta: { label: t('Model'), mobileTitle: true },
      header: t('Model'),
      cell: ({ row }) => (
        <span className='block truncate font-mono text-xs font-semibold tracking-[-0.01em] sm:text-sm'>
          {row.original.model_name}
        </span>
      ),
      minSize: 180,
      enableSorting: false,
    },

    // 输入（数字列按内容收紧，多余宽度留给成功率）
    {
      id: 'input_price',
      meta: { label: t('Input') },
      header: t('Input'),
      cell: ({ row }) => (
        <CatalogPriceCell
          model={row.original}
          kind='input'
          options={options}
        />
      ),
      size: 92,
      enableSorting: false,
    },

    // 输出
    {
      id: 'output_price',
      meta: { label: t('Output') },
      header: t('Output'),
      cell: ({ row }) => (
        <CatalogPriceCell
          model={row.original}
          kind='output'
          options={options}
        />
      ),
      size: 92,
      enableSorting: false,
    },

    // 缓存
    {
      id: 'cached_price',
      meta: { label: t('Cached') },
      header: t('Cached'),
      cell: ({ row }) => (
        <CachedPriceCell model={row.original} options={options} />
      ),
      size: 92,
      enableSorting: false,
    },

    // TPS
    {
      id: 'tps',
      meta: { label: 'TPS' },
      header: 'TPS',
      cell: ({ row }) => (
        <ModelTpsCell
          modelName={row.original.model_name}
          perCall={row.original.quota_type === 1}
        />
      ),
      size: 76,
      enableSorting: false,
    },

    // 首字
    {
      id: 'ttft',
      meta: { label: t('First token') },
      header: t('First token'),
      cell: ({ row }) => (
        <ModelTtftCell
          modelName={row.original.model_name}
          perCall={row.original.quota_type === 1}
        />
      ),
      size: 88,
      enableSorting: false,
    },

    // 成功率
    {
      id: 'success_rate',
      meta: { label: t('Success rate') },
      header: t('Success rate'),
      cell: ({ row }) => (
        <div className='flex min-w-0 items-center justify-between gap-2'>
          <ModelSuccessCell
            modelName={row.original.model_name}
            perCall={row.original.quota_type === 1}
          />
          <button
            type='button'
            aria-label={`${t('View details')}: ${row.original.model_name}`}
            onClick={(event) => {
              event.stopPropagation()
              options.onModelClick?.(row.original.model_name)
            }}
            className={cn(
              'hover:bg-muted text-muted-foreground shrink-0 rounded-md p-0.5 transition-colors',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none'
            )}
          >
            <ChevronRight aria-hidden className='size-4' />
          </button>
        </div>
      ),
      size: 260,
      enableSorting: false,
    },
  ]
}
