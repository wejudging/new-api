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
import { describe, expect, test } from 'vitest'

import {
  formatPromoCountdown,
  promoCaption,
  promoCountdownLabel,
  promoExpiryLabel,
  promoOffLabel,
} from '@/lib/promo-caption'
import type { PromoPricing } from '@/lib/promo-pricing'

/**
 * Deadlines are formatted in the viewer's timezone, so the fixture is built
 * from local components to keep the expectation stable on any machine.
 */
const LOCAL_DEADLINE = new Date(2026, 9, 1, 23, 59, 0)
const LOCAL_DEADLINE_LABEL = 'Ends 2026-10-01 23:59'

/** Minimal `t` stub that renders the interpolation the captions rely on. */
const t = ((key: string, options?: Record<string, unknown>) => {
  let out = key
  for (const [name, value] of Object.entries(options ?? {})) {
    out = out.replaceAll(`{{${name}}}`, String(value))
  }
  return out
}) as TFunction

function makePromo(overrides: Partial<PromoPricing> = {}): PromoPricing {
  return {
    enabled: true,
    title: 'DeepSeek 限时半价',
    expiresAt: '',
    discount: 0.5,
    models: ['deepseek*'],
    ...overrides,
  }
}

describe('promo captions', () => {
  test('describes the discount as a percentage off', () => {
    expect(promoOffLabel(makePromo(), t)).toBe('50% off')
    expect(promoOffLabel(makePromo({ discount: 0.8 }), t)).toBe('20% off')
  })

  test('labels a zero multiplier as limited-time free', () => {
    expect(promoOffLabel(makePromo({ discount: 0 }), t)).toBe('Limited-time free')
  })

  test('renders the deadline when one is configured', () => {
    expect(promoExpiryLabel(makePromo(), t)).toBe('')
    expect(
      promoExpiryLabel(
        makePromo({ expiresAt: LOCAL_DEADLINE.toISOString() }),
        t
      )
    ).toBe(LOCAL_DEADLINE_LABEL)
  })

  test('joins the discount and the deadline', () => {
    expect(promoCaption(makePromo(), t)).toBe('50% off')
    expect(
      promoCaption(makePromo({ expiresAt: LOCAL_DEADLINE.toISOString() }), t)
    ).toBe(`50% off · ${LOCAL_DEADLINE_LABEL}`)
  })

  test('renders the countdown as a clock, with days in front of it', () => {
    expect(formatPromoCountdown(45_000, t)).toBe('00:00:45')
    expect(
      formatPromoCountdown(
        2 * 86_400_000 + 5 * 3_600_000 + 12 * 60_000 + 33_000,
        t
      )
    ).toBe('2d 05:12:33')
  })

  test('counts down to the deadline instead of printing it', () => {
    const now =
      LOCAL_DEADLINE.getTime() -
      (3 * 86_400_000 + 12 * 3_600_000 + 34 * 60_000 + 56_000)

    expect(promoCountdownLabel(makePromo(), t, now)).toBe('')
    expect(
      promoCountdownLabel(
        makePromo({ expiresAt: LOCAL_DEADLINE.toISOString() }),
        t,
        now
      )
    ).toBe('Ends in 3d 12:34:56')
  })

  test('drops the countdown once the deadline is reached', () => {
    const expiresAt = makePromo({ expiresAt: LOCAL_DEADLINE.toISOString() })

    expect(promoCountdownLabel(expiresAt, t, LOCAL_DEADLINE.getTime())).toBe('')
    expect(
      promoCountdownLabel(expiresAt, t, LOCAL_DEADLINE.getTime() + 60_000)
    ).toBe('')
  })
})
