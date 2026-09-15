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
import { cn } from '@/lib/utils'

type PromoPriceProps = {
  /** Regular price. */
  original: string
  /** Campaign price; falls back to `original` when omitted or identical. */
  promo?: string
  /**
   * Layout for the two-price variant. Without a campaign the plain price is
   * rendered as bare text, so callers keep owning their price element.
   */
  className?: string
}

/**
 * Renders a limited-time price: the regular price struck through followed by
 * the campaign price in red. Without a campaign this renders the plain price,
 * so the regular markup stays untouched.
 */
export function PromoPrice(props: PromoPriceProps) {
  const { original, promo, className } = props
  if (!promo || promo === original) return original

  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-baseline gap-x-1.5',
        className
      )}
    >
      <span className='text-muted-foreground line-through decoration-1'>
        {original}
      </span>
      <span className='font-semibold text-red-500'>{promo}</span>
    </span>
  )
}
