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

import { getCacheHitRate } from '../format'

describe('cache hit rate', () => {
  test('divides by the reported prompt tokens for OpenAI-style usage', () => {
    const rate = getCacheHitRate({ cache_tokens: 300 }, 480)

    expect(rate?.hitTokens).toBe(300)
    expect(rate?.totalTokens).toBe(480)
    expect(rate?.label).toBe('62.50%')
  })

  test('adds cache reads back for Anthropic-style usage', () => {
    // Anthropic reports prompt_tokens as the uncached input only.
    const rate = getCacheHitRate(
      { cache_tokens: 300, usage_semantic: 'anthropic' },
      100
    )

    expect(rate?.totalTokens).toBe(400)
    expect(rate?.label).toBe('75.00%')
  })

  test('counts split cache writes in the Anthropic denominator', () => {
    const rate = getCacheHitRate(
      {
        cache_tokens: 300,
        cache_creation_tokens: 400,
        cache_creation_tokens_5m: 100,
        usage_semantic: 'anthropic',
      },
      100
    )

    // The 5m/1h split wins over the legacy aggregate field.
    expect(rate?.totalTokens).toBe(500)
    expect(rate?.label).toBe('60.00%')
  })

  test('falls back to the legacy cache creation field when there is no split', () => {
    const rate = getCacheHitRate(
      {
        cache_tokens: 300,
        cache_creation_tokens: 100,
        usage_semantic: 'anthropic',
      },
      100
    )

    expect(rate?.totalTokens).toBe(500)
    expect(rate?.label).toBe('60.00%')
  })

  test('keeps two decimals on the label', () => {
    expect(getCacheHitRate({ cache_tokens: 6299 }, 10000)?.label).toBe('62.99%')
    expect(getCacheHitRate({ cache_tokens: 2 }, 3)?.label).toBe('66.67%')
  })

  test('returns null when the request logged no cache hit', () => {
    // A cache write without any read-out is not a hit, so nothing is shown.
    expect(getCacheHitRate({ cache_creation_tokens: 200 }, 480)).toBeNull()
    expect(getCacheHitRate({ cache_tokens: 0 }, 480)).toBeNull()
    expect(getCacheHitRate({}, 480)).toBeNull()
    expect(getCacheHitRate(null, 480)).toBeNull()
    expect(getCacheHitRate(undefined, 480)).toBeNull()
  })

  test('never reports more than 100%', () => {
    // Some upstreams report a prompt count that excludes the cached part even
    // in OpenAI-style payloads.
    expect(getCacheHitRate({ cache_tokens: 300 }, 100)?.label).toBe('100.00%')
  })

  test('survives a missing or unusable prompt count', () => {
    expect(getCacheHitRate({ cache_tokens: 300 }, 0)?.label).toBe('100.00%')
    expect(getCacheHitRate({ cache_tokens: 300 }, Number.NaN)?.label).toBe(
      '100.00%'
    )
  })
})
