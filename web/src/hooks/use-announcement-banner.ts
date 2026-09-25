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
import type { TFunction } from 'i18next'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { promoOffLabel } from '@/lib/promo-caption'
import type { PromoPricing } from '@/lib/promo-pricing'

import { useNotifications } from './use-notifications'
import { usePromoPricing } from './use-promo-pricing'

/** Height of one banner row, consumed by the app shell for its scroll math. */
export const ANNOUNCEMENT_BANNER_HEIGHT = '2.25rem'

/** Newest announcements shown in the announcement row. */
const MAX_BANNER_ANNOUNCEMENTS = 5

export type AnnouncementBannerItem = {
  key: string
  content: string
  /** Campaign the row counts down to, when it is a limited-time offer. */
  campaign?: PromoPricing
}

function collapseWhitespace(input: string): string {
  return input.replaceAll(/\s+/g, ' ').trim()
}

function buildPromoItems(
  promos: PromoPricing[],
  t: TFunction
): AnnouncementBannerItem[] {
  return promos.map((promo, index) => {
    const title = collapseWhitespace(promo.title) || t('Limited-time offer')
    return {
      key: `promo:${promo.id || index}`,
      content: `${title} · ${promoOffLabel(promo, t)}`,
      campaign: promo,
    }
  })
}

function buildAnnouncementItems(
  announcements: Record<string, unknown>[]
): AnnouncementBannerItem[] {
  const items: AnnouncementBannerItem[] = []

  for (const announcement of announcements.slice(0, MAX_BANNER_ANNOUNCEMENTS)) {
    const content = collapseWhitespace(String(announcement.content ?? ''))
    if (!content) continue

    const extra = collapseWhitespace(String(announcement.extra ?? ''))
    items.push({
      key: `announcement:${announcement.id ?? content}`,
      content: extra ? `${content} · ${extra}` : content,
    })
  }

  return items
}

/**
 * Feeds the top rows of the app shell: each active limited-time campaign gets
 * its own row, then the newest platform announcements. The measured height is
 * dropped entirely while it has nothing to show.
 */
export function useAnnouncementBanner() {
  const { t } = useTranslation()
  const { announcements } = useNotifications()
  const { promos } = usePromoPricing()

  const promoItems = useMemo(() => buildPromoItems(promos, t), [promos, t])
  const announcementItems = useMemo(
    () => buildAnnouncementItems(announcements),
    [announcements]
  )
  const rowCount = promoItems.length + (announcementItems.length > 0 ? 1 : 0)
  const [height, setHeight] = useState(
    rowCount === 0 ? '0px' : `calc(${rowCount} * ${ANNOUNCEMENT_BANNER_HEIGHT})`
  )

  useEffect(() => {
    const element = document.querySelector<HTMLElement>(
      '[data-announcement-banner]'
    )
    if (!element || typeof ResizeObserver === 'undefined') {
      setHeight(rowCount === 0 ? '0px' : `calc(${rowCount} * ${ANNOUNCEMENT_BANNER_HEIGHT})`)
      return
    }

    const updateHeight = () => {
      setHeight(`${Math.ceil(element.getBoundingClientRect().height)}px`)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [rowCount, promoItems, announcementItems])

  return {
    promos: promoItems,
    announcements: announcementItems,
    visible: rowCount > 0,
    height,
  }
}
