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
import { Megaphone, Sparkles } from 'lucide-react'

import type { AnnouncementBannerItem } from '@/hooks/use-announcement-banner'
import { cn } from '@/lib/utils'

import { PromoCountdown } from './promo-countdown'

type AnnouncementBannerProps = {
  /** Active limited-time campaigns. */
  promos: AnnouncementBannerItem[]
  /** Newest platform announcements; the row hides itself while empty. */
  announcements: AnnouncementBannerItem[]
  className?: string
}

const ROW_CLASS =
  'flex min-h-9 w-full shrink-0 items-start gap-2 px-3 py-2 text-xs'

/**
 * Centered row body. Text wraps on narrow screens instead of being clipped or
 * requiring a horizontal swipe; the surrounding layout observes the real
 * banner height through ResizeObserver.
 */
function AnnouncementBannerText(props: {
  items: AnnouncementBannerItem[]
  className?: string
}) {
  return (
    <div className='min-w-0 flex-1'>
      <div
        className={cn(
          'mx-auto flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center break-words whitespace-normal',
          props.className
        )}
      >
        {props.items.map((item, index) => (
          <div key={item.key} className='flex min-w-0 max-w-full items-start gap-3'>
            {index > 0 ? (
              <span
                className='h-3 w-px shrink-0 bg-current opacity-40'
                aria-hidden
              />
            ) : null}
            <span className='min-w-0 break-words' title={item.content}>
              {item.content}
              {item.campaign ? <PromoCountdown promo={item.campaign} /> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Top rows of the app shell: the limited-time campaign in its own red bar and
 * the platform announcements right below it. A row that has nothing to show is
 * not rendered at all, and neither row can be dismissed.
 */
export function AnnouncementBanner(props: AnnouncementBannerProps) {
  if (props.promos.length === 0 && props.announcements.length === 0) return null

  return (
    <div
      data-announcement-banner
      className={cn(
        'relative z-60 flex w-full shrink-0 flex-col',
        props.className
      )}
    >
      {props.promos.map((promo) => (
        <div
          key={promo.key}
          role='status'
          className={cn(ROW_CLASS, 'bg-red-600 text-white')}
        >
          <Sparkles className='mt-0.5 size-3.5 shrink-0 opacity-90' aria-hidden />
          <AnnouncementBannerText items={[promo]} className='font-semibold' />
        </div>
      ))}
      {props.announcements.length > 0 ? (
        <div
          role='status'
          className={cn(
            ROW_CLASS,
            'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-100'
          )}
        >
          <Megaphone className='size-3.5 shrink-0 opacity-90' aria-hidden />
          <AnnouncementBannerText
            items={props.announcements}
            className='font-medium'
          />
        </div>
      ) : null}
    </div>
  )
}
