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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { TieredPricingEditor } from '../tiered-pricing-editor'

const PEAK_TIER_EXPR =
  '(weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && (hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 || hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18)) ? tier("peak", p * 0.8 + c * 3.2 + cr * 0.016) : tier("off_peak", p * 0.4 + c * 1.6 + cr * 0.008)'

describe('peak / off-peak tier preset', () => {
  test('applies the preset and opens it as editable tiers', async () => {
    const onBillingExprChange = vi.fn()
    render(
      <TieredPricingEditor
        billingExpr=''
        requestRuleExpr=''
        onBillingExprChange={onBillingExprChange}
        onRequestRuleExprChange={vi.fn()}
      />
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'More templates...' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Peak / off-peak tiers (Mon-Fri 9-12, 14-18)',
      })
    )

    expect(onBillingExprChange).toHaveBeenLastCalledWith(PEAK_TIER_EXPR)
    expect(
      screen.getByRole('group', { name: 'Pricing tier peak' })
    ).toBeVisible()
    expect(
      screen.getByRole('group', { name: 'Pricing tier off_peak' })
    ).toBeVisible()
  })
})
