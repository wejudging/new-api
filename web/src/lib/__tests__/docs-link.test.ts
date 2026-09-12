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

import { DEFAULT_DOCS_URL } from '@/lib/constants'
import { resolveDocsUrl } from '@/lib/docs-link'

describe('docs link resolution', () => {
  test('falls back to the bundled documentation site when unset', () => {
    expect(resolveDocsUrl()).toBe(DEFAULT_DOCS_URL)
    expect(resolveDocsUrl('')).toBe(DEFAULT_DOCS_URL)
    expect(resolveDocsUrl('   ')).toBe(DEFAULT_DOCS_URL)
  })

  test('replaces upstream documentation links with the bundled site', () => {
    expect(resolveDocsUrl('https://docs.newapi.pro')).toBe(DEFAULT_DOCS_URL)
    expect(
      resolveDocsUrl(
        'https://docs.newapi.pro/zh/docs/guide/feature-guide/user/api/'
      )
    ).toBe(DEFAULT_DOCS_URL)
  })

  test('keeps custom documentation links untouched', () => {
    expect(resolveDocsUrl('https://doc.hohai.eu.org/guide')).toBe(
      'https://doc.hohai.eu.org/guide'
    )
    expect(resolveDocsUrl('https://example.com/docs')).toBe(
      'https://example.com/docs'
    )
  })
})
