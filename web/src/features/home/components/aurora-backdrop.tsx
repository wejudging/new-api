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

/**
 * Ambient background for the landing page: a cool gradient wash, three slowly
 * drifting aurora orbs and a masked grid. Purely decorative, so it is hidden
 * from assistive technology and ignores pointer events.
 */
export function AuroraBackdrop() {
  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'
    >
      <div className='absolute inset-0 bg-gradient-to-b from-sky-500/[0.07] via-transparent to-violet-500/[0.07]' />

      <div className='landing-aurora-orb absolute -top-56 -left-40 size-[38rem] rounded-full bg-radial from-sky-400/30 via-sky-400/5 to-transparent blur-3xl dark:from-sky-500/25' />
      <div className='landing-aurora-orb-slow absolute -top-32 -right-40 size-[34rem] rounded-full bg-radial from-violet-400/30 via-violet-400/5 to-transparent blur-3xl dark:from-violet-500/25' />
      <div className='landing-aurora-orb absolute top-[38rem] left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-radial from-fuchsia-400/20 via-fuchsia-400/5 to-transparent blur-3xl dark:from-fuchsia-500/15' />

      <div className='absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_25%,black_15%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.07]' />
    </div>
  )
}
