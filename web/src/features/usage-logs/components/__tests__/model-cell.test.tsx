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

// The browser-only icon packages cannot be loaded by Vitest's Node ESM
// resolver; the model column only needs the icon slot to stay empty.
vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
  getLobeIconNames: () => [],
}))

vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterAll(() => vi.unstubAllGlobals())

function ModelCellPreview(props: { log: UsageLog }) {
  const table = useReactTable({
    data: [props.log],
    columns: useCommonLogsColumns(false, false),
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((item) => item.column.id === 'model_name')
  if (!cell) throw new Error('The log must render a model_name column')

  return (
    <>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
      <span data-testid='column-ids'>
        {table
          .getAllColumns()
          .map((column) => column.id)
          .join(',')}
      </span>
    </>
  )
}

function buildLog(other: Record<string, unknown>): UsageLog {
  return usageLogSchema.parse({
    id: 1,
    user_id: 2,
    created_at: 1788840000,
    type: 2,
    content: '',
    model_name: 'deepseek-v3',
    prompt_tokens: 100,
    completion_tokens: 120,
    quota: 4200,
    other: JSON.stringify(other),
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
        <ModelCellPreview log={log} />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

describe('reasoning effort in the model column', () => {
  test('shows the requested effort after the model name without adding a column', async () => {
    const rendered = await renderCell(buildLog({ reasoning_effort: 'high' }))

    expect(screen.getByText('deepseek-v3')).toBeVisible()
    expect(screen.getByText('high')).toBeVisible()
    expect(rendered.getByTestId('column-ids').textContent).not.toContain(
      'reasoning_effort'
    )
  })

  test('shows nothing extra when the request did not specify an effort', async () => {
    const rendered = await renderCell(buildLog({}))

    expect(screen.getByText('deepseek-v3')).toBeVisible()
    expect(screen.queryByText('high')).not.toBeInTheDocument()
    expect(
      rendered.container.querySelector('[aria-label^="Reasoning Effort:"]')
    ).toBeNull()
  })
})
