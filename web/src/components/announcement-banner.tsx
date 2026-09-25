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
import { ChevronLeft, ChevronRight, Megaphone, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AnnouncementBannerItem } from '@/hooks/use-announcement-banner'
import type { PromoColor } from '@/lib/promo-pricing'
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
  'flex min-h-9 w-full shrink-0 items-center gap-2 px-3 py-2 text-xs'

/** Rotation interval for the single-row carousel, matching b.ai's pace. */
const ROTATE_MS = 5000

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

type BannerSlide = {
  key: string
  item: AnnouncementBannerItem
  className: string
  icon: React.ReactNode
  textClassName?: string
}

/**
 * Single-row top strip: every active campaign and the newest announcements
 * share one bar and rotate on a timer, with arrows for manual switching — the
 * b.ai pattern. Text still wraps on narrow screens so a long notice stays
 * readable, and the shell measures the real height.
 */
export function AnnouncementBanner(props: AnnouncementBannerProps) {
  const slides = useMemo<BannerSlide[]>(
    () => [
      ...props.promos.map((promo) => ({
        key: promo.key,
        item: promo,
        className:
          PROMO_ROW_COLORS[promo.color ?? 'red'] ?? PROMO_ROW_COLORS.red,
        icon: <Sparkles className='size-3.5 shrink-0 opacity-90' aria-hidden />,
        textClassName: 'font-semibold',
      })),
      ...(props.announcements.length > 0
        ? [
            {
              key: 'announcements',
              item: props.announcements[0],
              className:
                'bg-rose-100/95 text-rose-900 dark:bg-rose-950/80 dark:text-rose-100',
              icon: (
                <Megaphone className='size-3.5 shrink-0 opacity-90' aria-hidden />
              ),
              textClassName: 'font-medium',
            } satisfies BannerSlide,
          ]
        : []),
    ],
    [props.promos, props.announcements]
  )

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length
  const step = useCallback(
    (delta: number) => {
      if (count === 0) return
      setIndex((current) => (current + delta + count) % count)
    },
    [count]
  )

  useEffect(() => {
    if (count < 2 || paused) return
    const timer = window.setInterval(() => step(1), ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [count, paused, step])

  useEffect(() => {
    if (index >= count) setIndex(0)
  }, [count, index])

  if (count === 0) return null

  const slide = slides[Math.min(index, count - 1)]
  // Announcements rotate individually; campaigns keep their own summary text.
  const items =
    slide.key === 'announcements' ? props.announcements : [slide.item]

  return (
    <div
      data-announcement-banner
      className={cn('relative z-60 flex w-full shrink-0 flex-col', props.className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div role='status' className={cn(ROW_CLASS, slide.className)}>
        {slide.icon}
        <AnnouncementBannerText items={items} className={slide.textClassName} />
        {count > 1 ? (
          <div className='flex shrink-0 items-center gap-0.5'>
            <button
              type='button'
              aria-label='Previous'
              onClick={() => step(-1)}
              className='rounded-sm p-0.5 opacity-80 transition hover:opacity-100'
            >
              <ChevronLeft className='size-3.5' aria-hidden />
            </button>
            <span className='tabular-nums opacity-80'>
              {Math.min(index, count - 1) + 1}/{count}
            </span>
            <button
              type='button'
              aria-label='Next'
              onClick={() => step(1)}
              className='rounded-sm p-0.5 opacity-80 transition hover:opacity-100'
            >
              <ChevronRight className='size-3.5' aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
