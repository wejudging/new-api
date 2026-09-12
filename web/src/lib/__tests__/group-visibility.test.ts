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

import { isSingleGroupScope } from '@/lib/group-visibility'

describe('group visibility', () => {
  test('treats missing and empty scopes as a single group', () => {
    expect(isSingleGroupScope()).toBe(true)
    expect(isSingleGroupScope([])).toBe(true)
    expect(isSingleGroupScope(['', '  '])).toBe(true)
  })

  test('hides the group UI when only the default group exists', () => {
    expect(isSingleGroupScope(['default'])).toBe(true)
  })

  test('keeps the group UI when several or custom groups exist', () => {
    expect(isSingleGroupScope(['default', 'vip'])).toBe(false)
    expect(isSingleGroupScope(['vip'])).toBe(false)
  })
})
