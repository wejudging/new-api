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

import { usePromoPricing } from '@/hooks/use-promo-pricing'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel } from '../types'
import type { ModelPriceCellOptions } from './model-price-cell'
import { PromoPrice } from './promo-price'

export type CatalogPriceKind = 'input' | 'output'

const EXPRESSION_FIELD: Record<CatalogPriceKind, string> = {
  input: 'inputPrice',
  output: 'outputPrice',
}

/**
 * One price column of the catalog table.
 *
 * The table shows plain amounts — ratio pricing for token models and the
 * current tier of an expression for tiered models — so the three price columns
 * line up without the descriptive captions the detail drawer uses.
 */
export function CatalogPriceCell(props: {
  model: PricingModel
  kind: CatalogPriceKind
  options?: ModelPriceCellOptions
}) {
  const { t } = useTranslation()
  const options = props.options ?? {}
  const tokenUnit = options.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const currency = useSystemConfigStore((state) => state.config.currency)
  const billingTime = useBillingTime(props.model.billing_expr)
  const { getDiscount } = usePromoPricing()
  const discount = getDiscount(props.model.model_name) ?? 1
  const usesExpression = Boolean((props.model.billing_expr ?? '').trim())

  // Regular (undiscounted) price for the current tier.
  const dynamic = useMemo(
    () =>
      usesExpression || !isTokenBasedModel(props.model)
        ? getDynamicPricingSummary(props.model, {
            now: billingTime === undefined ? undefined : new Date(billingTime),
            tokenUnit,
            showRechargePrice: options.showRechargePrice,
            priceRate: options.priceRate,
            usdExchangeRate: options.usdExchangeRate,
            groupRatioMultiplier: getDynamicDisplayGroupRatio(
              props.model,
              options.selectedGroup
            ),
          })
        : null,
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.model,
      usesExpression,
      tokenUnit,
      options.showRechargePrice,
      options.priceRate,
      options.usdExchangeRate,
      options.selectedGroup,
      billingTime,
      currency,
    ]
  )

  // Campaign prices come from the same summary evaluated *with* the discount,
  // matched by entry key, so the regular amount stays as the struck-through
  // original and the cheaper amount is the highlighted campaign price.
  const promoEntries = useMemo(() => {
    if (discount === 1 || !dynamic) return new Map<string, string>()
    const promoSummary = getDynamicPricingSummary(props.model, {
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit,
      showRechargePrice: options.showRechargePrice,
      priceRate: options.priceRate,
      usdExchangeRate: options.usdExchangeRate,
      discount,
      groupRatioMultiplier: getDynamicDisplayGroupRatio(
        props.model,
        options.selectedGroup
      ),
    })
    if (!promoSummary) return new Map<string, string>()
    return new Map(
      [...promoSummary.entries, ...promoSummary.primaryEntries].map((entry) => [
        entry.key,
        entry.formatted,
      ])
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.model,
    dynamic,
    discount,
    tokenUnit,
    options.showRechargePrice,
    options.priceRate,
    options.usdExchangeRate,
    options.selectedGroup,
    billingTime,
  ])

  if (dynamic) {
    const field = EXPRESSION_FIELD[props.kind]
    const findEntry = (target: string) =>
      dynamic.primaryEntries.find((item) => item.field === target) ??
      dynamic.entries.find((item) => item.field === target)
    const splitEntry = findEntry(field)
    // Request- and task-priced models bill per call: that amount belongs to
    // the output column (with a "/call" marker) and the input column stays
    // empty, since there is no separate input price.
    const perCall =
      dynamic.primaryEntries.find((item) => item.unit === 'request') ??
      dynamic.entries.find((item) => item.unit === 'request') ??
      findEntry('modelPrice')
    const entry = splitEntry ?? (props.kind === 'output' ? perCall : undefined)

    if (!entry) {
      return <span className='text-muted-foreground/50 text-xs'>—</span>
    }

    return (
      <span className='font-mono text-xs font-semibold tabular-nums sm:text-sm'>
        <PromoPrice
          original={entry.formatted}
          promo={promoEntries.get(entry.key)}
        />
        {!splitEntry && perCall ? (
          <span className='text-muted-foreground text-[10px] font-normal'>
            {t('/call')}
          </span>
        ) : null}
      </span>
    )
  }

  // Plain per-call models carry no expression: their amount belongs to the
  // output column (with a "/call" marker), matching the tiered case above.
  if (props.model.quota_type === 1) {
    if (props.kind === 'input') {
      return <span className='text-muted-foreground/50 text-xs'>—</span>
    }
    const requestValue = formatRequestPrice(
      props.model,
      options.showRechargePrice,
      options.priceRate,
      options.usdExchangeRate,
      options.selectedGroup
    )
    const promoRequestValue =
      discount !== 1
        ? formatRequestPrice(
            props.model,
            options.showRechargePrice,
            options.priceRate,
            options.usdExchangeRate,
            options.selectedGroup,
            true,
            discount
          )
        : undefined
    return (
      <span className='font-mono text-xs font-semibold tabular-nums sm:text-sm'>
        <PromoPrice original={requestValue} promo={promoRequestValue} />
        <span className='text-muted-foreground text-[10px] font-normal'>
          {t('/call')}
        </span>
      </span>
    )
  }

  const value = formatPrice(
    props.model,
    props.kind,
    tokenUnit,
    options.showRechargePrice,
    options.priceRate,
    options.usdExchangeRate,
    options.selectedGroup
  )
  const promoValue =
    discount !== 1
      ? formatPrice(
          props.model,
          props.kind,
          tokenUnit,
          options.showRechargePrice,
          options.priceRate,
          options.usdExchangeRate,
          options.selectedGroup,
          true,
          discount
        )
      : undefined

  return (
    <span className='font-mono text-xs font-semibold tabular-nums sm:text-sm'>
      <PromoPrice original={value} promo={promoValue} />
    </span>
  )
}
