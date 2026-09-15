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

import {
  getPromoDiscountForModel,
  isPromoPricingActive,
  parsePromoPricing,
  type PromoPricing,
} from '@/lib/promo-pricing'
import { useSystemConfigStore } from '@/stores/system-config-store'

export type PromoPricingState = {
  /** Active campaign, `null` when disabled, expired or unconfigured. */
  promo: PromoPricing | null
  active: boolean
  /** Displayed-price multiplier for a model, `undefined` when not covered. */
  getDiscount: (modelName?: string) => number | undefined
}

/**
 * Read the limited-time campaign that the `/api/status` query mirrors into the
 * system config store, so components showing prices do not need a query
 * provider (and a cold start can still render the discounted price).
 */
export function usePromoPricing(): PromoPricingState {
  const raw = useSystemConfigStore((state) => state.config.promoPricing)

  return useMemo(() => {
    const parsed = parsePromoPricing(raw)
    if (!isPromoPricingActive(parsed)) {
      return {
        promo: null,
        active: false,
        getDiscount: () => undefined,
      }
    }

    return {
      promo: parsed,
      active: true,
      getDiscount: (modelName?: string) =>
        getPromoDiscountForModel(parsed, modelName),
    }
  }, [raw])
}
