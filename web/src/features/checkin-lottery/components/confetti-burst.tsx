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
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { cn } from '@/lib/utils'

/**
 * How long a burst stays mounted. Slightly past the longest piece so the
 * animation always finishes before the layer is dropped.
 */
const BURST_LIFE_MS = 2600

/** Colours are theme tokens, so the burst follows light and dark mode. */
const TONES = ['primary', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'warning']

const EMOJI = ['🎉', '🎊', '✨']

interface ConfettiBurstProps {
  /** Layout is derived from this, so a draw always looks the same. */
  seed: number
  pieces?: number
  className?: string
}

interface ConfettiPiece {
  /** Stable across re-renders, because the layout is seeded. */
  id: string
  className: string
  style: CSSProperties
  emoji: string
}

/**
 * Firework of confetti pieces and party emoji over the prize board, played
 * once when a draw lands. Purely decorative: it is hidden from assistive
 * technology, ignores pointer events and removes itself when it is done.
 */
export function ConfettiBurst({
  seed,
  pieces = 72,
  className,
}: ConfettiBurstProps) {
  const [alive, setAlive] = useState(true)
  const bits = useMemo(() => buildPieces(seed, pieces), [seed, pieces])

  useEffect(() => {
    setAlive(true)
    const timer = window.setTimeout(() => setAlive(false), BURST_LIFE_MS)
    return () => window.clearTimeout(timer)
  }, [seed])

  if (!alive) return null

  return (
    <div
      aria-hidden='true'
      data-testid='checkin-confetti'
      className={cn(
        'pointer-events-none absolute inset-0 z-10 overflow-hidden',
        className
      )}
    >
      {bits.map((bit) => (
        <span key={bit.id} className={bit.className} style={bit.style}>
          {bit.emoji}
        </span>
      ))}
    </div>
  )
}

/**
 * Deterministic PRNG, so a given draw always produces the same burst. Random
 * layouts would otherwise churn on every re-render of the page.
 */
function mulberry32(seed: number): () => number {
  let state = Math.trunc(seed) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Five cannons: three along the bottom and two raised on the sides, angled
 * inwards. `bias` pushes the drift of a cannon towards the middle so the side
 * shots cross the board instead of falling straight down.
 */
const ORIGINS = [
  { left: 50, top: 96, spread: 1, bias: 0 },
  { left: 4, top: 96, spread: 0.62, bias: 0.55 },
  { left: 96, top: 96, spread: 0.62, bias: -0.55 },
  { left: -1, top: 58, spread: 0.5, bias: 0.8 },
  { left: 101, top: 58, spread: 0.5, bias: -0.8 },
]

/**
 * Piece shapes: party emoji, thin streamers and square confetti chips. The mix
 * is what makes the burst look busy, so one roll of the PRNG decides which of
 * the three a piece becomes.
 */
type PieceKind = 'emoji' | 'streamer' | 'chip'

function pickKind(roll: number): PieceKind {
  if (roll < 0.3) return 'emoji'
  if (roll < 0.62) return 'streamer'
  return 'chip'
}

const KIND_CLASS: Record<PieceKind, string> = {
  emoji: 'checkin-confetti checkin-confetti-emoji',
  streamer: 'checkin-confetti checkin-confetti-streamer',
  chip: 'checkin-confetti',
}

/** Width range in px: emoji are large, streamers thin, chips in between. */
const KIND_SIZE: Record<PieceKind, { min: number; span: number }> = {
  emoji: { min: 16, span: 12 },
  streamer: { min: 4, span: 3 },
  chip: { min: 7, span: 6 },
}

function buildPieces(seed: number, count: number): ConfettiPiece[] {
  const random = mulberry32(seed + 1)
  const bits: ConfettiPiece[] = []

  for (let index = 0; index < count; index += 1) {
    const origin = ORIGINS[index % ORIGINS.length]
    const kind = pickKind(random())

    const drift = (random() - 0.5 + origin.bias) * 2 * 230 * origin.spread
    const rise = 110 + random() * 210
    const fall = 140 + random() * 220
    const spin = (random() < 0.5 ? -1 : 1) * (360 + random() * 720)
    const size = KIND_SIZE[kind].min + random() * KIND_SIZE[kind].span
    const height = kind === 'streamer' ? 13 + random() * 10 : size

    bits.push({
      id: `${seed}-${index}`,
      emoji: kind === 'emoji' ? EMOJI[Math.floor(random() * EMOJI.length)] : '',
      className: KIND_CLASS[kind],
      style: {
        left: `${origin.left + (random() - 0.5) * 8}%`,
        top: `${origin.top}%`,
        '--confetti-size': `${size.toFixed(2)}px`,
        '--confetti-height': `${height.toFixed(2)}px`,
        '--confetti-x': `${drift.toFixed(1)}px`,
        '--confetti-y': `${(fall - rise).toFixed(1)}px`,
        '--confetti-apex-x': `${(drift * 0.5).toFixed(1)}px`,
        '--confetti-apex-y': `${(-rise).toFixed(1)}px`,
        '--confetti-spin': `${spin.toFixed(0)}deg`,
        '--confetti-delay': `${(random() * 260).toFixed(0)}ms`,
        '--confetti-duration': `${(1500 + random() * 800).toFixed(0)}ms`,
        '--confetti-color': `var(--${TONES[index % TONES.length]})`,
      } as CSSProperties,
    })
  }

  return bits
}
