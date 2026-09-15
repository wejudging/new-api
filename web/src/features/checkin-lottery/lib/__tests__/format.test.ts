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
import { describe, expect, it } from 'vitest'

import { formatRank, formatYuan } from '../format'

describe('check-in lottery formatting', () => {
  it('renders prize amounts in CNY with two decimals', () => {
    expect(formatYuan(0.05)).toBe('¥0.05')
    expect(formatYuan(0.5)).toBe('¥0.50')
    expect(formatYuan(1)).toBe('¥1.00')
  })

  it('falls back to a dash for missing amounts', () => {
    expect(formatYuan(undefined)).toBe('-')
    expect(formatYuan(null)).toBe('-')
    expect(formatYuan(Number.NaN)).toBe('-')
  })

  it('labels ranks without inventing a position for unranked users', () => {
    expect(formatRank(1)).toBe('#1')
    expect(formatRank(10)).toBe('#10')
    expect(formatRank(0)).toBe('-')
  })
})
