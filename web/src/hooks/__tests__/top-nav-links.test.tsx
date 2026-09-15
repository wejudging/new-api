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
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { useTopNavLinks } from '../use-top-nav-links'

afterEach(() => {
  cleanup()
  useAuthStore.getState().auth.reset()
})

function topNavFor(status: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], status)

  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }

  return renderHook(() => useTopNavLinks(), { wrapper: Wrapper })
}

describe('top navigation links', () => {
  it('keeps the module entries of the default header configuration', () => {
    const { result } = topNavFor({ HeaderNavModules: '' })

    expect(result.current.map((link) => link.title)).toEqual([
      'Home',
      'Console',
      'Model Square',
      'Rankings',
      'About',
    ])
  })

  it('never renders the usage docs entry, even when the backend enables it', () => {
    const { result } = topNavFor({
      HeaderNavModules: JSON.stringify({ docs: true }),
      docs_link: 'https://doc.hohai.eu.org',
    })

    expect(result.current.map((link) => link.title)).not.toContain('Usage Docs')
    expect(result.current.every((link) => link.external !== true)).toBe(true)
  })

  it('honours the switches the admin panel still exposes', () => {
    const { result } = topNavFor({
      HeaderNavModules: JSON.stringify({
        home: false,
        console: false,
        about: false,
        pricing: { enabled: false, requireAuth: false },
        rankings: { enabled: true, requireAuth: true },
      }),
    })

    expect(result.current.map((link) => link.title)).toEqual(['Rankings'])
    expect(result.current[0]?.requiresAuth).toBe(true)
  })
})
