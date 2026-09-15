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
import { describe, expect, test } from 'vitest'

import {
  discountPercentFromMultiplier,
  matchedDiscountPercent,
  matchedRuleMultiplier,
  ruleDiscountLabel,
  ruleDiscountPercent,
} from '../request-rule-discount'

describe('matched request-rule discounts', () => {
  test('multiplies only the rules that fired', () => {
    expect(
      matchedRuleMultiplier([
        { multiplier: 0.5, matched: true },
        { multiplier: 2, matched: false },
      ])
    ).toBe(0.5)
  })

  test('combines several matched rules', () => {
    expect(
      matchedRuleMultiplier([
        { multiplier: '0.5', matched: true },
        { multiplier: 0.9, matched: true },
      ])
    ).toBeCloseTo(0.45)
  })

  test('ignores unmatched, missing and unusable multipliers', () => {
    expect(matchedRuleMultiplier(undefined)).toBe(1)
    expect(matchedRuleMultiplier([{ multiplier: 0.5 }])).toBe(1)
    expect(matchedRuleMultiplier([{ multiplier: 'n/a', matched: true }])).toBe(
      1
    )
    expect(matchedRuleMultiplier([{ multiplier: -1, matched: true }])).toBe(1)
  })

  test('reports the saving of the matched rules only', () => {
    expect(matchedDiscountPercent([{ multiplier: 0.5, matched: true }])).toBe(
      50
    )
    expect(matchedDiscountPercent([{ multiplier: 0.8, matched: false }])).toBe(
      0
    )
    expect(
      matchedDiscountPercent([
        { multiplier: 0.5, matched: true },
        { multiplier: 2, matched: true },
      ])
    ).toBe(0)
  })

  test('turns a multiplier into a percentage off', () => {
    expect(discountPercentFromMultiplier(0.5)).toBe(50)
    expect(discountPercentFromMultiplier(0.85)).toBe(15)
    expect(discountPercentFromMultiplier(1)).toBe(0)
    expect(discountPercentFromMultiplier(2)).toBe(0)
    expect(discountPercentFromMultiplier(Number.NaN)).toBe(0)
  })

  test('advertises a rule regardless of whether it fired yet', () => {
    expect(ruleDiscountPercent('0.5')).toBe(50)
    expect(ruleDiscountPercent(2)).toBe(0)
    expect(ruleDiscountPercent(undefined)).toBe(0)
  })

  test('labels a saving with the shared campaign wording', () => {
    const translate = (key: string, options?: Record<string, unknown>) =>
      key.replace('{{percent}}', String(options?.percent))
    expect(ruleDiscountLabel(50, translate as never)).toBe('50% off')
  })
})
