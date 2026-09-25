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
  getActivePromoPricings,
  getPromoDiscountForModel,
  getPromoPricingForModel,
  parsePromoPricing,
  type PromoPricing,
} from '@/lib/promo-pricing'
import { useSystemConfigStore } from '@/stores/system-config-store'

export type PromoPricingState = {
  /** All active campaigns, ordered as configured. */
  promos: PromoPricing[]
  active: boolean
  /** Displayed-price multiplier for a model, `undefined` when not covered. */
  getDiscount: (modelName?: string) => number | undefined
  /** The most specific active campaign covering a model. */
  getPromo: (modelName?: string) => PromoPricing | undefined
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
    const promos = getActivePromoPricings(parsed)
    if (promos.length === 0) {
      return {
        promos: [],
        active: false,
        getDiscount: () => undefined,
        getPromo: () => undefined,
      }
    }

    return {
      promos,
      active: true,
      getDiscount: (modelName?: string) =>
        getPromoDiscountForModel(promos, modelName),
      getPromo: (modelName?: string) => {
        return getPromoPricingForModel(promos, modelName)
      },
    }
  }, [raw])
}
