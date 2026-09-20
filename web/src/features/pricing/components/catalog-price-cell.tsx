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

import { usePromoPricing } from '@/hooks/use-promo-pricing'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice } from '../lib/price'
import type { PricingModel } from '../types'
import { ModelPriceCell, type ModelPriceCellOptions } from './model-price-cell'
import { PromoPrice } from './promo-price'

export type CatalogPriceKind = 'input' | 'output'

/**
 * Single-price cell for the catalog table (输入价格 / 输出价格).
 *
 * Token-based models render one price with its per-token-unit caption so the
 * two columns line up like the reference catalog. Request-, task- and
 * expression-priced models have no input/output split: their price keeps the
 * existing rich cell in the input column and the output column stays empty.
 */
export function CatalogPriceCell(props: {
  model: PricingModel
  kind: CatalogPriceKind
  options?: ModelPriceCellOptions
}) {
  const { t } = useTranslation()
  const options = props.options ?? {}
  const tokenUnit = options.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const tokenUnitLabel =
    tokenUnit === 'K' ? t('Per 1K tokens') : t('Per 1M tokens')
  const { getDiscount } = usePromoPricing()
  const discount = getDiscount(props.model.model_name) ?? 1
  const hasPromo = discount !== 1

  if (!isTokenBasedModel(props.model)) {
    if (props.kind === 'output') {
      return <span className='text-muted-foreground/50 text-xs'>—</span>
    }
    return <ModelPriceCell model={props.model} options={options} />
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
  const promoValue = hasPromo
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
    <div className='flex min-w-0 flex-col gap-0.5'>
      <span className='font-mono text-sm font-semibold tabular-nums'>
        <PromoPrice
          className='inline-flex flex-wrap items-baseline gap-x-1'
          original={value}
          promo={promoValue}
        />
      </span>
      <span className='text-muted-foreground text-xs'>{tokenUnitLabel}</span>
    </div>
  )
}
