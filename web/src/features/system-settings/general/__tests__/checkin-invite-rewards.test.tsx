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

import { SettingsPageProvider } from '../../components/settings-page-context'
import { CheckinSettingsSection } from '../checkin-settings-section'

const defaults = {
  enabled: true,
  requireTopUp: true,
  dailyDraws: 1,
  topUpYuanPerDraw: 10,
  referralBaseTickets: 1,
  prizeMinAmount: 0.01,
  prizeMaxAmount: 2,
  prizeExpected: 0.1,
  prizeTiers: 12,
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
        <CheckinSettingsSection defaultValues={defaults} />
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
      initialEntries: ['/system-settings/billing/checkin'],
    }),
  })

  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('check-in invite rewards', () => {
  it('groups the invite ticket count in its own card and saves it', async () => {
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true, message: 'ok' } })
    const user = userEvent.setup()

    renderSection()

    // The card has to be unmistakable: operators looking for the invite reward
    // used to hunt for a field that read like part of the top-up bonus.
    expect(await screen.findByText('Invite rewards')).toBeVisible()
    expect(
      screen.getByText(
        "Draw tickets for the inviter and the invited friend after the friend's first top-up"
      )
    ).toBeVisible()

    const tickets = await screen.findByRole('spinbutton', {
      name: 'Base invite draw tickets',
    })
    expect(tickets).toHaveValue(1)

    await user.clear(tickets)
    await user.type(tickets, '2')
    await user.click(
      screen.getByRole('button', { name: 'Save check-in settings' })
    )

    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0]?.[1]).toEqual({
      key: 'checkin_setting.referral_base_tickets',
      value: '2',
    })
  })
})
