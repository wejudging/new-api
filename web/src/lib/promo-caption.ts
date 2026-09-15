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
import type { TFunction } from 'i18next'

import dayjs from '@/lib/dayjs'
import {
  getPromoExpiry,
  getPromoOffPercent,
  type PromoPricing,
} from '@/lib/promo-pricing'

/** Deadline format shared by every campaign caption. */
export const PROMO_EXPIRY_FORMAT = 'YYYY-MM-DD HH:mm'

/** `50% off` label for a limited-time campaign. */
export function promoOffLabel(promo: PromoPricing, t: TFunction): string {
  return t('{{percent}}% off', { percent: getPromoOffPercent(promo.discount) })
}

/** `Ends 2026-10-01 23:59`, or an empty string when there is no deadline. */
export function promoExpiryLabel(promo: PromoPricing, t: TFunction): string {
  const expiry = getPromoExpiry(promo)
  if (expiry === null) return ''
  return t('Ends {{time}}', {
    time: dayjs(expiry).format(PROMO_EXPIRY_FORMAT),
  })
}

/** Caption fragment describing an active campaign, e.g. `50% off · Ends …`. */
export function promoCaption(promo: PromoPricing, t: TFunction): string {
  return [promoOffLabel(promo, t), promoExpiryLabel(promo, t)]
    .filter(Boolean)
    .join(' · ')
}
