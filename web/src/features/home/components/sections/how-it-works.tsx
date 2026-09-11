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
import { Settings, Zap, BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Configure'),
      desc: t(
        'Add your API keys, set up channels and configure access permissions'
      ),
      icon: <Settings className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Integrate'),
      desc: t(
        'Connect through OpenAI, Claude, Gemini, and other compatible API routes'
      ),
      icon: <Zap className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Monitor'),
      desc: t('Track usage, costs and performance with real-time analytics'),
      icon: <BarChart3 className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='relative z-10 px-6 py-20 md:py-28'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <p className='text-primary mb-3 text-xs font-semibold tracking-[0.2em] uppercase'>
            {t('How It Works')}
          </p>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
            {t('Three steps to get started')}
          </h2>
        </AnimateInView>

        <div className='relative'>
          {/* Connector line behind the step tiles */}
          <div
            aria-hidden
            className='from-primary/0 via-primary/30 to-primary/0 absolute top-8 right-[18%] left-[18%] hidden h-px bg-gradient-to-r md:block'
          />

          <div className='relative grid gap-10 md:grid-cols-3 md:gap-12'>
            {steps.map((step, index) => (
              <AnimateInView
                key={step.num}
                delay={index * 150}
                animation='fade-up'
                className='group relative flex flex-col items-center text-center'
              >
                <div className='relative mb-6'>
                  <div className='border-border/50 bg-card/60 text-muted-foreground group-hover:border-primary/40 group-hover:text-primary flex size-16 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1'>
                    {step.icon}
                  </div>
                  <div className='absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-xs font-bold text-white shadow-md'>
                    {step.num}
                  </div>
                </div>
                <h3 className='mb-2 text-base font-semibold'>{step.title}</h3>
                <p className='text-muted-foreground max-w-[240px] text-sm leading-relaxed'>
                  {step.desc}
                </p>
              </AnimateInView>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
