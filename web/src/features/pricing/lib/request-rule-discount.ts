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

/** Anything carrying a request-rule multiplier, matched and trace shapes alike. */
export type MatchedMultiplierSource = {
  multiplier: number | string
  matched?: boolean
}

/**
 * Combined multiplier of the request rules that actually applied. Rules that
 * did not match, or that carry an unusable multiplier, are ignored, so the
 * result is `1` for a request without a discount.
 */
export function matchedRuleMultiplier(
  rules: readonly MatchedMultiplierSource[] | null | undefined
): number {
  let factor = 1
  for (const rule of rules ?? []) {
    if (rule.matched !== true) continue
    const value = Number(rule.multiplier)
    if (!Number.isFinite(value) || value < 0) continue
    factor *= value
  }
  return factor
}

/**
 * Whole-percent saving of a multiplier, e.g. `50` for `0.5x`. Returns `0`
 * when the multiplier does not lower the price.
 */
export function discountPercentFromMultiplier(factor: number): number {
  if (!Number.isFinite(factor) || factor >= 1) return 0
  return Math.round((1 - factor) * 100)
}

/**
 * Combined saving of the request rules that actually applied, e.g. `50` for a
 * single matched `0.5x` rule. Returns `0` when no rule lowered the price, so
 * callers can use it as a plain "is this request discounted?" test.
 */
export function matchedDiscountPercent(
  rules: readonly MatchedMultiplierSource[] | null | undefined
): number {
  return discountPercentFromMultiplier(matchedRuleMultiplier(rules))
}

/**
 * Saving advertised by a single rule, whatever its current match state, so
 * pricing lists can describe a campaign that only fires inside its window.
 */
export function ruleDiscountPercent(
  multiplier: number | string | null | undefined
): number {
  return discountPercentFromMultiplier(Number(multiplier))
}

/** `50% off` wording shared with the limited-time pricing captions. */
export function ruleDiscountLabel(percent: number, t: TFunction): string {
  return t('{{percent}}% off', { percent })
}
