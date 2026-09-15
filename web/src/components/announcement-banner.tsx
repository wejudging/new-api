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
import { Megaphone, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { AnnouncementBannerItem } from '@/hooks/use-announcement-banner'
import { cn } from '@/lib/utils'

type AnnouncementBannerProps = {
  items: AnnouncementBannerItem[]
  visible: boolean
  onDismiss: () => void
  className?: string
}

/**
 * Top row of the app shell: limited-time campaigns and the newest platform
 * announcements, scrollable in a single line and dismissible per visitor.
 */
export function AnnouncementBanner(props: AnnouncementBannerProps) {
  const { t } = useTranslation()

  if (!props.visible || props.items.length === 0) return null

  return (
    <div
      role='status'
      className={cn(
        'relative z-60 flex h-9 w-full shrink-0 items-center gap-2 overflow-hidden bg-red-600 px-2.5 text-white sm:px-3',
        props.className
      )}
    >
      <Megaphone className='size-3.5 shrink-0 opacity-90' aria-hidden />
      <div className='flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-3 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden'>
        {props.items.map((item, index) => (
          <div key={item.key} className='flex shrink-0 items-center gap-3'>
            {index > 0 ? (
              <span className='h-3 w-px shrink-0 bg-white/40' aria-hidden />
            ) : null}
            {item.tone === 'promo' ? (
              <Sparkles className='size-3.5 shrink-0' aria-hidden />
            ) : null}
            <span
              className={cn(
                'text-xs',
                item.tone === 'promo' ? 'font-semibold' : 'font-medium'
              )}
              title={item.content}
            >
              {item.content}
            </span>
          </div>
        ))}
      </div>
      <button
        type='button'
        onClick={props.onDismiss}
        aria-label={t('Close')}
        className='-mr-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white'
      >
        <X className='size-3.5' />
      </button>
    </div>
  )
}
