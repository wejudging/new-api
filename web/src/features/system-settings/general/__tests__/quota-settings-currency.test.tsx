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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
  type CurrencyConfig,
} from '@/stores/system-config-store'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { QuotaSettingsSection } from '../quota-settings-section'

/** Raw quota values as the backend stores them: 500,000 quota units = 1 USD. */
const defaults = {
  QuotaForNewUser: 500000,
  PreConsumedQuota: 500,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  TopUpLink: '',
  general_setting: { docs_link: '' },
  quota_setting: { enable_free_model_pre_consume: false },
}

function setCurrency(overrides: Partial<CurrencyConfig>) {
  useSystemConfigStore.setState((state) => ({
    config: {
      ...state.config,
      currency: { ...DEFAULT_CURRENCY_CONFIG, ...overrides },
    },
  }))
}

function Section() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
  )

  return (
    <QueryClientProvider client={client}>
      <SettingsPageProvider actionsContainer={container}>
        <div ref={setContainer} />
        <QuotaSettingsSection defaultValues={defaults} />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

function renderSection() {
  const root = createRootRoute()
  const route = createRoute({
    getParentRoute: () => root,
    path: 'system-settings/billing/$section',
    component: Section,
  })
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({
      initialEntries: ['/system-settings/billing/quota'],
    }),
  })

  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('quota settings in the site balance unit', () => {
  it('shows raw quota as balance amounts and saves the quota back', async () => {
    setCurrency({
      displayInCurrency: true,
      quotaDisplayType: 'CNY',
      quotaPerUnit: 500000,
      usdExchangeRate: 1,
    })
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true, message: 'ok' } })
    const user = userEvent.setup()

    renderSection()

    const newUserQuota = await screen.findByRole('spinbutton', {
      name: 'New User Quota',
    })
    expect(newUserQuota).toHaveValue(1)
    expect(
      screen.getByRole('spinbutton', { name: 'Pre-Consumed Quota' })
    ).toHaveValue(0.001)
    expect(screen.getByText(/1 ¥ = 500,000/)).toBeVisible()

    await user.clear(newUserQuota)
    await user.type(newUserQuota, '2')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    // Editing one field must not rewrite the others, and the balance amount
    // has to travel back to the backend as raw quota units.
    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0]?.[1]).toEqual({
      key: 'QuotaForNewUser',
      value: 1000000,
    })
  })

  it('keeps raw quota units editable when currency display is off', async () => {
    setCurrency({
      displayInCurrency: false,
      quotaDisplayType: 'TOKENS',
      quotaPerUnit: 500000,
      usdExchangeRate: 1,
    })
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true, message: 'ok' } })
    const user = userEvent.setup()

    renderSection()

    const newUserQuota = await screen.findByRole('spinbutton', {
      name: 'New User Quota',
    })
    expect(newUserQuota).toHaveValue(500000)

    await user.clear(newUserQuota)
    await user.type(newUserQuota, '250000')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0]?.[1]).toEqual({
      key: 'QuotaForNewUser',
      value: 250000,
    })
  })
})
