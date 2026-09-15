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

type AnnouncementBannerProps = {
  /** Active limited-time campaign, or `null` when there is none. */
  promo: AnnouncementBannerItem | null
  /** Newest platform announcements; the row hides itself while empty. */
  announcements: AnnouncementBannerItem[]
  className?: string
}

const ROW_CLASS =
  'flex h-9 w-full shrink-0 items-center gap-2 px-3 text-xs whitespace-nowrap'

/**
 * Centred, single-line row body: text sits in the middle of the row and only
 * scrolls horizontally once it is too long to fit.
 */
function AnnouncementBannerText(props: {
  items: AnnouncementBannerItem[]
  className?: string
}) {
  return (
    <div className='min-w-0 flex-1 [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden'>
      <div
        className={cn('mx-auto flex w-max items-center gap-3', props.className)}
      >
        {props.items.map((item, index) => (
          <div key={item.key} className='flex shrink-0 items-center gap-3'>
            {index > 0 ? (
              <span
                className='h-3 w-px shrink-0 bg-current opacity-40'
                aria-hidden
              />
            ) : null}
            <span title={item.content}>{item.content}</span>
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
  if (!props.promo && props.announcements.length === 0) return null

  return (
    <div
      className={cn(
        'relative z-60 flex w-full shrink-0 flex-col',
        props.className
      )}
    >
      {props.promo ? (
        <div role='status' className={cn(ROW_CLASS, 'bg-red-600 text-white')}>
          <Sparkles className='size-3.5 shrink-0 opacity-90' aria-hidden />
          <AnnouncementBannerText
            items={[props.promo]}
            className='font-semibold'
          />
        </div>
      ) : null}
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
