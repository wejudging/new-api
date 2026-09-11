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
import { getLobeIcon } from '@/lib/lobe-icon'

import { AI_APPLICATIONS, AI_MODELS } from '../constants'

const MARQUEE_BRANDS = [...AI_MODELS, ...AI_APPLICATIONS]

/**
 * Seamless logo strip: the brand list is rendered twice and the track is
 * translated by half its width, so the loop never shows a gap. The duplicate
 * copy is hidden from assistive technology to avoid reading the list twice.
 */
export function ProviderMarquee() {
  return (
    <section className='border-border/40 bg-muted/5 relative z-10 border-y'>
      <div className='landing-marquee relative overflow-hidden py-7'>
        <div className='landing-marquee-track flex w-max items-center gap-14 px-7'>
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className='flex items-center gap-14'
            >
              {MARQUEE_BRANDS.map((brand) => (
                <div
                  key={`${copy}-${brand}`}
                  className='flex items-center gap-3 opacity-60 transition-opacity duration-300 hover:opacity-100'
                >
                  <span className='flex size-8 items-center justify-center'>
                    {getLobeIcon(brand, 28)}
                  </span>
                  <span className='text-foreground/80 text-sm font-medium whitespace-nowrap'>
                    {brand.replace('.Color', '')}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className='from-background pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r to-transparent' />
        <div className='from-background pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l to-transparent' />
      </div>
    </section>
  )
}
