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
  DEFAULT_PROMO_DISCOUNT,
  getPromoDiscountForModel,
  getPromoExpiry,
  getPromoOffPercent,
  isPromoPricingActive,
  matchesPromoModel,
  parsePromoPricing,
  type PromoPricing,
} from '@/lib/promo-pricing'

const EXPIRES_AT = '2026-10-01T23:59:00+08:00'

function makePromo(overrides: Partial<PromoPricing> = {}): PromoPricing {
  return {
    enabled: true,
    title: 'DeepSeek 限时半价',
    expiresAt: EXPIRES_AT,
    discount: 0.5,
    models: ['deepseek*'],
    ...overrides,
  }
}

describe('parsePromoPricing', () => {
  test('returns null when the option is empty or malformed', () => {
    expect(parsePromoPricing(null)).toEqual([])
    expect(parsePromoPricing(undefined)).toEqual([])
    expect(parsePromoPricing('')).toEqual([])
    expect(parsePromoPricing('   ')).toEqual([])
    expect(parsePromoPricing('{not json')).toEqual([])
    expect(parsePromoPricing('[]')).toEqual([])
    expect(parsePromoPricing('42')).toEqual([])
    expect(parsePromoPricing(42)).toEqual([])
  })

  test('parses the JSON string stored in the option', () => {
    expect(parsePromoPricing(JSON.stringify(makePromo()))).toEqual([
      { ...makePromo(), id: 'campaign-1' },
    ])
  })

  test('parses an already-decoded object', () => {
    expect(parsePromoPricing(makePromo())).toEqual([
      { ...makePromo(), id: 'campaign-1' },
    ])
  })

  test('fills defaults for missing fields', () => {
    expect(parsePromoPricing('{}')).toEqual([
      {
        id: 'campaign-1',
        enabled: false,
        title: '',
        expiresAt: '',
        discount: DEFAULT_PROMO_DISCOUNT,
        models: [],
      },
    ])
  })

  test('accepts string flags and numbers', () => {
    const parsed = parsePromoPricing({
      enabled: 'true',
      discount: '0.25',
      title: '  Half price  ',
      models: [' deepseek-chat ', 'deepseek-chat', 7, ''],
    })

    expect(parsed).toMatchObject({
      enabled: true,
      discount: 0.25,
      title: 'Half price',
      models: ['deepseek-chat'],
    })
  })

  test('rejects discounts outside (0, 1]', () => {
    expect(parsePromoPricing({ discount: 0 })[0]?.discount).toBe(0)
    expect(parsePromoPricing({ discount: 1.5 })[0]?.discount).toBe(
      DEFAULT_PROMO_DISCOUNT
    )
    expect(parsePromoPricing({ discount: -0.5 })[0]?.discount).toBe(
      DEFAULT_PROMO_DISCOUNT
    )
    expect(parsePromoPricing({ discount: 'abc' })[0]?.discount).toBe(
      DEFAULT_PROMO_DISCOUNT
    )
    expect(parsePromoPricing({ discount: 1 })[0]?.discount).toBe(1)
  })
})

describe('getPromoExpiry', () => {
  test('returns null without a usable timestamp', () => {
    expect(getPromoExpiry(null)).toBeNull()
    expect(getPromoExpiry(makePromo({ expiresAt: '' }))).toBeNull()
    expect(getPromoExpiry(makePromo({ expiresAt: 'whenever' }))).toBeNull()
  })

  test('returns the deadline in milliseconds', () => {
    expect(getPromoExpiry(makePromo())).toBe(Date.parse(EXPIRES_AT))
  })
})

describe('isPromoPricingActive', () => {
  test('requires an enabled campaign with at least one model', () => {
    expect(isPromoPricingActive(null)).toBe(false)
    expect(isPromoPricingActive(makePromo({ enabled: false }))).toBe(false)
    expect(isPromoPricingActive(makePromo({ models: [] }))).toBe(false)
    expect(isPromoPricingActive(makePromo())).toBe(true)
    expect(isPromoPricingActive(makePromo({ discount: 0 }))).toBe(true)
  })

  test('treats a campaign without a deadline as active', () => {
    expect(isPromoPricingActive(makePromo({ expiresAt: '' }))).toBe(true)
  })

  test('expires once the deadline is reached', () => {
    const expiry = Date.parse(EXPIRES_AT)

    expect(isPromoPricingActive(makePromo(), expiry - 1000)).toBe(true)
    expect(isPromoPricingActive(makePromo(), expiry)).toBe(false)
    expect(isPromoPricingActive(makePromo(), expiry + 1000)).toBe(false)
  })
})

describe('matchesPromoModel', () => {
  test('matches exact names case-insensitively', () => {
    const promo = makePromo({ models: ['DeepSeek-Chat'] })

    expect(matchesPromoModel(promo, 'deepseek-chat')).toBe(true)
    expect(matchesPromoModel(promo, '  DEEPSEEK-CHAT  ')).toBe(true)
    expect(matchesPromoModel(promo, 'deepseek-reasoner')).toBe(false)
  })

  test('supports wildcards', () => {
    expect(matchesPromoModel(makePromo(), 'deepseek-chat')).toBe(true)
    expect(matchesPromoModel(makePromo(), 'deepseek-reasoner')).toBe(true)
    expect(matchesPromoModel(makePromo(), 'gpt-4o')).toBe(false)
    expect(
      matchesPromoModel(makePromo({ models: ['*'] }), 'anything-at-all')
    ).toBe(true)
    expect(
      matchesPromoModel(makePromo({ models: ['*-preview'] }), 'x-preview')
    ).toBe(true)
  })

  test('rejects empty input', () => {
    expect(matchesPromoModel(makePromo(), undefined)).toBe(false)
    expect(matchesPromoModel(makePromo(), '')).toBe(false)
    expect(matchesPromoModel(makePromo(), '   ')).toBe(false)
    expect(matchesPromoModel(null, 'deepseek-chat')).toBe(false)
  })
})

describe('getPromoDiscountForModel', () => {
  test('returns the discount for covered models only', () => {
    const promo = makePromo()

    expect(getPromoDiscountForModel(promo, 'deepseek-chat')).toBe(0.5)
    expect(getPromoDiscountForModel(promo, 'gpt-4o')).toBeUndefined()
    expect(getPromoDiscountForModel(null, 'deepseek-chat')).toBeUndefined()
  })

  test('ignores expired campaigns', () => {
    const promo = makePromo()
    const now = Date.parse(EXPIRES_AT) + 1000

    expect(
      getPromoDiscountForModel(promo, 'deepseek-chat', now)
    ).toBeUndefined()
  })
})

describe('getPromoOffPercent', () => {
  test('converts a multiplier into a percentage off', () => {
    expect(getPromoOffPercent(0.5)).toBe(50)
    expect(getPromoOffPercent(1)).toBe(0)
    expect(getPromoOffPercent(0.8)).toBe(20)
    expect(getPromoOffPercent(0.666)).toBe(33)
  })
})
