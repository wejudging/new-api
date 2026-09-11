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
import { Boxes, Cable, Route, SlidersHorizontal } from 'lucide-react'
import { useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

interface CounterProps {
  end: number
  suffix?: string
  prefix?: string
  duration?: number
  decimals?: number
}

function Counter(props: CounterProps) {
  const { end, suffix = '', prefix = '', duration = 1600, decimals = 0 } = props
  const ref = useRef<HTMLSpanElement>(null)
  const startedRef = useRef(false)

  const formatValue = useCallback(
    (v: number) =>
      decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString(),
    [decimals]
  )

  const animate = useCallback(() => {
    const el = ref.current
    if (!el) return
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      el.textContent = `${prefix}${formatValue(eased * end)}${suffix}`
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [end, duration, prefix, suffix, formatValue])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) {
      el.textContent = `${prefix}${formatValue(end)}${suffix}`
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true
          animate()
          observer.unobserve(el)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [animate, end, prefix, suffix, formatValue])

  return (
    <span ref={ref} className='tabular-nums'>
      {prefix}0{suffix}
    </span>
  )
}

interface StatsProps {
  className?: string
}

interface StatItem {
  end: number
  suffix: string
  label: string
  decimals?: number
}

const STAT_ICONS = [Cable, Boxes, Route, SlidersHorizontal]

export function Stats(_props: StatsProps) {
  const { t } = useTranslation()

  const stats: StatItem[] = [
    { end: 50, suffix: '+', label: t('upstream services integrated') },
    { end: 100, suffix: '+', label: t('model billing support') },
    { end: 50, suffix: '+', label: t('compatible API routes') },
    { end: 10, suffix: '+', label: t('scheduling controls') },
  ]

  return (
    <section className='relative z-10 px-6 py-16 md:py-20'>
      <div className='mx-auto max-w-6xl'>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6'>
          {stats.map((stat, index) => {
            const Icon = STAT_ICONS[index % STAT_ICONS.length]
            return (
              <AnimateInView
                key={stat.label}
                delay={index * 80}
                className='group border-border/50 bg-card/40 hover:border-primary/30 hover:shadow-primary/5 relative overflow-hidden rounded-2xl border p-6 text-center shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg'
              >
                <div
                  aria-hidden
                  className='bg-primary/15 pointer-events-none absolute -top-16 left-1/2 size-32 -translate-x-1/2 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100'
                />
                <div className='relative flex flex-col items-center'>
                  <span className='border-border/50 bg-muted/40 text-muted-foreground group-hover:text-primary mb-3 flex size-9 items-center justify-center rounded-xl border transition-colors duration-300'>
                    <Icon className='size-4' strokeWidth={1.75} />
                  </span>
                  <span className='bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl'>
                    <Counter end={stat.end} suffix={stat.suffix} />
                  </span>
                  <span className='text-muted-foreground mt-2 text-xs leading-relaxed'>
                    {stat.label}
                  </span>
                </div>
              </AnimateInView>
            )
          })}
        </div>
      </div>
    </section>
  )
}
