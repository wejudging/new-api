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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { promoCountdownLabel } from '@/lib/promo-caption'
import type { PromoPricing } from '@/lib/promo-pricing'

type PromoCountdownProps = {
  /** Active campaign whose deadline is counted down. */
  promo: PromoPricing
}

/**
 * Live `· Ends in 3d 12:34:56` suffix for a limited-time campaign row.
 *
 * The clock ticks inside this leaf component so only the label re-renders
 * every second. Without a deadline the suffix is dropped entirely, so the row
 * keeps a clean caption instead of a dangling separator.
 */
export function PromoCountdown(props: PromoCountdownProps) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const label = promoCountdownLabel(props.promo, t, now)
  if (!label) return null

  return <span className='tabular-nums'>{` · ${label}`}</span>
}
