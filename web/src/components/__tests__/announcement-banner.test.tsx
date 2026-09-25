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
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnnouncementBannerItem } from '@/hooks/use-announcement-banner'

import { AnnouncementBanner } from '../announcement-banner'

const promo: AnnouncementBannerItem = {
  key: 'promo',
  content: 'DeepSeek 全线限时半价 · 50% off · Ends 2026-10-01 23:59',
}

const announcement: AnnouncementBannerItem = {
  key: 'announcement:1',
  content: '平台维护通知',
}

describe('top banner rows', () => {
  it('renders the campaign and the announcement as two separate rows', () => {
    render(<AnnouncementBanner promos={[promo]} announcements={[announcement]} />)

    const rows = screen.getAllByRole('status')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(promo.content)
    expect(rows[1]).toHaveTextContent(announcement.content)
  })

  it('keeps the campaign row alone while there is no announcement', () => {
    render(<AnnouncementBanner promos={[promo]} announcements={[]} />)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByText(announcement.content)).toBeNull()
  })

  it('keeps the announcement row alone while there is no campaign', () => {
    render(<AnnouncementBanner promos={[]} announcements={[announcement]} />)

    const rows = screen.getAllByRole('status')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent(announcement.content)
  })

  it('renders no row without a campaign and without announcements', () => {
    const { container } = render(
      <AnnouncementBanner promos={[]} announcements={[]} />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('centres the row content with auto margins so short text sits mid-row', () => {
    render(<AnnouncementBanner promos={[promo]} announcements={[]} />)

    const row = screen.getByRole('status')
    const content = row.querySelector('.mx-auto')
    expect(content).not.toBeNull()
    expect(content).toHaveTextContent(promo.content)
    expect(content).toHaveClass('w-max')
  })

  it('offers no dismiss control on either row', () => {
    render(<AnnouncementBanner promos={[promo]} announcements={[announcement]} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('joins several announcements in the single announcement row', () => {
    const second: AnnouncementBannerItem = {
      key: 'announcement:2',
      content: '新模型上线',
    }
    render(
      <AnnouncementBanner promos={[]} announcements={[announcement, second]} />
    )

    const rows = screen.getAllByRole('status')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('平台维护通知')
    expect(rows[0]).toHaveTextContent('新模型上线')
  })
})

describe('live campaign countdown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks the campaign row down instead of printing the deadline', () => {
    vi.useFakeTimers()
    const deadline = new Date(2026, 9, 1, 12, 0, 0)
    const remaining = 2 * 86_400_000 + 5 * 3_600_000 + 12 * 60_000 + 33_000
    vi.setSystemTime(deadline.getTime() - remaining)

    const campaignPromo: AnnouncementBannerItem = {
      key: 'promo',
      content: 'DeepSeek 全线限时半价 · 50% off',
      campaign: {
        enabled: true,
        title: 'DeepSeek 全线限时半价',
        expiresAt: deadline.toISOString(),
        discount: 0.5,
        models: ['deepseek*'],
      },
    }

    render(<AnnouncementBanner promos={[campaignPromo]} announcements={[]} />)
    const row = screen.getByRole('status')
    expect(row).toHaveTextContent('Ends in 2d 05:12:33')
    expect(row).not.toHaveTextContent('2026-10-01')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(row).toHaveTextContent('Ends in 2d 05:12:32')
  })

  it('keeps the caption clean when the campaign has no deadline', () => {
    render(
      <AnnouncementBanner
        promos={[{
          key: 'promo',
          content: 'DeepSeek 全线限时半价 · 50% off',
          campaign: {
            enabled: true,
            title: 'DeepSeek 全线限时半价',
            expiresAt: '',
            discount: 0.5,
            models: ['deepseek*'],
          },
        }]}
        announcements={[]}
      />
    )

    const row = screen.getByRole('status')
    expect(row).toHaveTextContent('DeepSeek 全线限时半价 · 50% off')
    expect(row.textContent).not.toMatch(/·\s*$/)
  })
})
