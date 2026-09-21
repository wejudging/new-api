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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getLobeIcon, resolveVendorIconId } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { FILTER_ALL } from '../constants'
import type { PricingModel, PricingVendor } from '../types'

export interface VendorFilterBarProps {
  vendors: PricingVendor[]
  models: PricingModel[]
  value: string
  onChange: (value: string) => void
  className?: string
}

type VendorOption = {
  value: string
  label: string
  count: number
  icon?: React.ReactNode
}

/**
 * Provider selector shown above the model list. Vendors are the only filter
 * this catalog needs, so the chips stay visible instead of hiding behind a
 * filter drawer.
 */
export function VendorFilterBar(props: VendorFilterBarProps) {
  const { t } = useTranslation()

  const options: VendorOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Vendors'),
      count: props.models.length,
    },
    ...props.vendors
      .map((vendor) => ({
        value: vendor.name,
        label: vendor.name,
        count: props.models.reduce(
          (count, model) => count + (model.vendor_name === vendor.name ? 1 : 0),
          0
        ),
        icon: (() => {
          const iconKey = vendor.icon || resolveVendorIconId(vendor.name)
          return iconKey ? getLobeIcon(iconKey, 14) : undefined
        })(),
      }))
      .filter((vendor) => vendor.count > 0),
  ]

  return (
    <div className={cn('bg-card rounded-xl border p-3', props.className)}>
      <div
        role='group'
        aria-label={t('All Vendors')}
        className='-mx-1 flex flex-wrap gap-1.5 px-1 py-0.5'
      >
        {options.map((option) => {
          const active = props.value === option.value
          return (
            <Button
              key={option.value}
              type='button'
              variant={active ? 'secondary' : 'outline'}
              size='sm'
              onClick={() => props.onChange(option.value)}
              aria-pressed={active}
              className='h-auto max-w-full shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:max-w-[220px]'
            >
              {option.icon && <span className='shrink-0'>{option.icon}</span>}
              <span className='truncate'>{option.label}</span>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[12px]',
                  active
                    ? 'bg-background text-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {option.count}
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
