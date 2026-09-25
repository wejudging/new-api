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
import type { AnnouncementBannerItem } from '@/hooks/use-announcement-banner'
import type { PromoColor } from '@/lib/promo-pricing'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

import { PromoCountdown } from './promo-countdown'

type AnnouncementBannerProps = {
  /** Active limited-time campaigns. */
  promos: AnnouncementBannerItem[]
  /** Newest platform announcements; the row hides itself while empty. */
  announcements: AnnouncementBannerItem[]
  className?: string
}

const ROW_CLASS =
  'flex h-9 w-full shrink-0 items-center gap-2 px-3 text-xs whitespace-nowrap'

/** Literal class strings so Tailwind keeps every preset in the bundle. */
const PROMO_ROW_COLORS: Record<PromoColor, string> = {
  red: 'bg-red-600/90 text-white',
  amber: 'bg-amber-500/90 text-amber-950',
  emerald: 'bg-emerald-600/90 text-white',
  sky: 'bg-sky-600/90 text-white',
  violet: 'bg-violet-600/90 text-white',
  slate: 'bg-slate-700/90 text-white',
}

/**
 * Single-line row body: the text sits centred while it fits and scrolls
 * horizontally when the viewport is too narrow, so it is never truncated and
 * never wraps into a second line.
 */
function AnnouncementBannerText(props: {
  items: AnnouncementBannerItem[]
  className?: string
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const measure = () => {
      const overflow = track.scrollWidth - viewport.clientWidth
      // Only rows that are actually too wide start moving.
      setShift(overflow > 4 ? overflow : 0)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(track)
    return () => observer.disconnect()
  }, [props.items])

  return (
    <div ref={viewportRef} className='min-w-0 flex-1 overflow-hidden'>
      <div
        ref={trackRef}
        className={cn(
          'mx-auto flex w-max items-center gap-3',
          shift > 0 && 'banner-ticker',
          props.className
        )}
        style={
          shift > 0
            ? ({
                '--banner-shift': `-${shift}px`,
                '--banner-duration': `${Math.max(14, Math.round(shift / 30))}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {props.items.map((item, index) => (
          <div key={item.key} className='flex shrink-0 items-center gap-3'>
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
 * Top rows of the app shell: one row per active campaign (each in its own
 * colour, no icon) and one row for the newest announcements. Every row stays
 * single-line and scrolls horizontally when the viewport is narrow; the app
 * shell measures the real height so the content below is never covered.
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
          className={cn(
            ROW_CLASS,
            PROMO_ROW_COLORS[promo.color ?? 'red'] ?? PROMO_ROW_COLORS.red
          )}
        >
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
          <AnnouncementBannerText
            items={props.announcements}
            className='font-medium'
          />
        </div>
      ) : null}
    </div>
  )
}
