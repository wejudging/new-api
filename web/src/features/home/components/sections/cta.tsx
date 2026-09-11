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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='relative z-10 px-6 pt-8 pb-24 md:pb-32'>
      <AnimateInView
        className='border-border/50 bg-card/40 shadow-primary/5 relative mx-auto max-w-4xl overflow-hidden rounded-3xl border px-6 py-16 text-center shadow-xl backdrop-blur-sm md:px-16 md:py-20'
        animation='scale-in'
      >
        {/* Ambient glow inside the panel */}
        <div
          aria-hidden
          className='pointer-events-none absolute -top-40 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-radial from-sky-500/25 via-violet-500/10 to-transparent blur-3xl'
        />
        <div
          aria-hidden
          className='from-primary/60 via-primary/20 pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r to-transparent'
        />

        <div className='relative'>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-5xl'>
            {t('Ready to simplify')}
            <br />
            <span className='bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent'>
              {t('your AI integration?')}
            </span>
          </h2>
          <p className='text-muted-foreground/80 mx-auto mt-5 max-w-md text-sm leading-relaxed md:text-base'>
            {t(
              'Deploy your own gateway and start routing requests through your configured upstream services.'
            )}
          </p>
          <div className='mt-9 flex flex-wrap items-center justify-center gap-3'>
            <Button
              className='group shadow-primary/25 hover:shadow-primary/35 h-11 rounded-lg px-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-105'
              render={<Link to='/sign-up' />}
            >
              {t('Get Started')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='border-border/50 hover:border-border hover:bg-muted/50 h-11 rounded-lg px-5'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          </div>
        </div>
      </AnimateInView>
    </section>
  )
}
