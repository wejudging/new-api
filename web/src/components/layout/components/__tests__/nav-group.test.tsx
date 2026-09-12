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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { BookOpen, Trophy } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import type { NavItem } from '@/components/layout/types'

import { NavGroup } from '../nav-group'

const items: NavItem[] = [
  { title: '排行榜', url: '/rankings', icon: Trophy },
  {
    title: '使用文档',
    url: 'https://doc.hohai.eu.org',
    external: true,
    icon: BookOpen,
  },
]

async function renderGroup() {
  const root = createRootRoute({
    component: () => (
      <SidebarProvider>
        <NavGroup title='常规' items={items} />
      </SidebarProvider>
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
}

describe('sidebar nav group', () => {
  it('routes internal entries through the router', async () => {
    await renderGroup()
    const link = screen.getByRole('link', { name: '排行榜' })
    expect(link).toHaveAttribute('href', '/rankings')
  })

  it('renders off-site entries as a new-tab anchor', async () => {
    await renderGroup()
    const link = screen.getByRole('link', { name: '使用文档' })
    expect(link).toHaveAttribute('href', 'https://doc.hohai.eu.org')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
