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
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterAll, describe, expect, test, vi } from 'vitest'

import en from '@/i18n/locales/en.json'

import { usageLogSchema, type UsageLog } from '../../data/schema'
import { useCommonLogsColumns } from '../columns/common-logs-columns'

// Provider icons are unused by the tokens column; their browser-only
// dependencies cannot be loaded by Vitest's Node ESM resolver.
vi.mock('@lobehub/icons', () => ({}))

vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterAll(() => vi.unstubAllGlobals())

function TokenCellPreview(props: { log: UsageLog }) {
  const table = useReactTable({
    data: [props.log],
    // Render as a regular user: the hit rate is for everyone, not just admins.
    columns: useCommonLogsColumns(false, false),
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((item) => item.column.id === 'prompt_tokens')
  if (!cell) throw new Error('The log must render a prompt_tokens column')

  return <>{flexRender(cell.column.columnDef.cell, cell.getContext())}</>
}

function buildLog(overrides: {
  prompt_tokens: number
  other: Record<string, unknown>
}): UsageLog {
  return usageLogSchema.parse({
    id: 1,
    user_id: 2,
    created_at: 1788840000,
    type: 2,
    content: '',
    model_name: 'deepseek-v3',
    prompt_tokens: overrides.prompt_tokens,
    completion_tokens: 120,
    quota: 4200,
    other: JSON.stringify(overrides.other),
  })
}

async function renderCell(log: UsageLog) {
  const i18n = createInstance()
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en },
    interpolation: { escapeValue: false },
  })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <TokenCellPreview log={log} />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

describe('cache hit rate in the tokens column', () => {
  test('shows the two-decimal share next to the cache read count', async () => {
    const rendered = await renderCell(
      buildLog({
        prompt_tokens: 480,
        other: { cache_tokens: 300, cache_creation_tokens_5m: 200 },
      })
    )

    const label = screen.getByText('62.50%')
    expect(label).toBeInTheDocument()
    expect(label).toHaveAttribute('title', 'Hit Rate 300 / 480')
    expect(rendered.container.textContent).toContain('480 / 120')
  })

  test('widens the denominator for Anthropic-style usage', async () => {
    await renderCell(
      buildLog({
        prompt_tokens: 100,
        other: {
          cache_tokens: 300,
          cache_creation_tokens: 100,
          usage_semantic: 'anthropic',
        },
      })
    )

    expect(screen.getByText('60.00%')).toHaveAttribute(
      'title',
      'Hit Rate 300 / 500'
    )
  })

  test('renders nothing when the request logged no cache hit', async () => {
    const rendered = await renderCell(
      buildLog({
        prompt_tokens: 480,
        other: { cache_creation_tokens: 200 },
      })
    )

    expect(rendered.container.textContent).not.toContain('%')
    expect(rendered.container.textContent).not.toContain('0.00')
    // The cache write marker itself still shows up.
    expect(rendered.container.textContent).toContain('↑ 200')
  })
})
