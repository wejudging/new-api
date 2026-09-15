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
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { promoCaption } from '@/lib/promo-caption'
import type { PromoPricing } from '@/lib/promo-pricing'
import { useAnnouncementBannerStore } from '@/stores/announcement-banner-store'

import { useNotifications } from './use-notifications'
import { usePromoPricing } from './use-promo-pricing'

/** Height of the banner row, consumed by the app shell for its scroll math. */
export const ANNOUNCEMENT_BANNER_HEIGHT = '2.25rem'

/** Newest announcements shown in the top row; the rest stay in the popover. */
const MAX_BANNER_ANNOUNCEMENTS = 5

export type AnnouncementBannerItem = {
  key: string
  content: string
  tone: 'promo' | 'default' | 'ongoing' | 'success' | 'warning' | 'error'
}

function collapseWhitespace(input: string): string {
  return input.replaceAll(/\s+/g, ' ').trim()
}

function toTone(type: unknown): AnnouncementBannerItem['tone'] {
  if (typeof type !== 'string') return 'default'
  if (
    type === 'promo' ||
    type === 'ongoing' ||
    type === 'success' ||
    type === 'warning' ||
    type === 'error'
  ) {
    return type
  }
  return 'default'
}

function buildPromoItem(
  promo: PromoPricing | null,
  t: TFunction
): AnnouncementBannerItem | null {
  if (!promo) return null

  const title = collapseWhitespace(promo.title) || t('Limited-time offer')
  return {
    key: 'promo',
    content: `${title} · ${promoCaption(promo, t)}`,
    tone: 'promo',
  }
}

function buildBannerItems(
  announcements: Record<string, unknown>[],
  promo: PromoPricing | null,
  t: TFunction
): AnnouncementBannerItem[] {
  const items: AnnouncementBannerItem[] = []

  const promoItem = buildPromoItem(promo, t)
  if (promoItem) items.push(promoItem)

  for (const announcement of announcements.slice(0, MAX_BANNER_ANNOUNCEMENTS)) {
    const content = collapseWhitespace(String(announcement.content ?? ''))
    if (!content) continue

    const extra = collapseWhitespace(String(announcement.extra ?? ''))
    items.push({
      key: `announcement:${announcement.id ?? content}`,
      content: extra ? `${content} · ${extra}` : content,
      tone: toTone(announcement.type),
    })
  }

  return items
}

/**
 * Feeds the top announcement row: the active limited-time campaign plus the
 * newest platform announcements.
 */
export function useAnnouncementBanner() {
  const { t } = useTranslation()
  const { announcements } = useNotifications()
  const { promo } = usePromoPricing()
  const dismissedSignature = useAnnouncementBannerStore(
    (state) => state.dismissedSignature
  )
  const dismiss = useAnnouncementBannerStore((state) => state.dismiss)

  const items = useMemo(
    () => buildBannerItems(announcements, promo, t),
    [announcements, promo, t]
  )
  const signature = useMemo(
    () => items.map((item) => item.content).join('|'),
    [items]
  )
  const visible = items.length > 0 && signature !== dismissedSignature

  const handleDismiss = useCallback(
    () => dismiss(signature),
    [dismiss, signature]
  )

  return {
    items,
    visible,
    height: visible ? ANNOUNCEMENT_BANNER_HEIGHT : '0px',
    dismiss: handleDismiss,
  }
}
