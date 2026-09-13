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
import type { CSSProperties } from 'react'

export type UserAvatarStyle = Pick<CSSProperties, 'backgroundColor' | 'color'>

/** Edge length (in cells) of the generated block avatar grid. */
export const IDENTICON_SIZE = 5
const IDENTICON_HALF = Math.ceil(IDENTICON_SIZE / 2)

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

/** Deterministic PRNG so the same name always yields the same picture. */
function createRandom(seed: number): () => number {
  let state = seed || 0x9e3779b9
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function getUserAvatarStyle(name: string): UserAvatarStyle {
  const hash = hashString(name)
  const hue = hash % 360
  const saturation = 54 + (hash % 8)
  const lightness = 52 + ((hash >> 4) % 8)

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: 'white',
  }
}

export function getUserAvatarFallback(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

/**
 * Blocky, horizontally mirrored 5×5 pattern derived from the account name —
 * the same idea as GitHub's identicon avatars, so every account gets a stable
 * picture instead of a single letter.
 *
 * @returns Row-major boolean grid of `IDENTICON_SIZE²` cells.
 */
export function getUserIdenticonCells(name: string): boolean[] {
  const random = createRandom(hashString(name.trim().toLowerCase()))
  const cells = Array.from(
    { length: IDENTICON_SIZE * IDENTICON_SIZE },
    () => false
  )

  for (let column = 0; column < IDENTICON_HALF; column++) {
    for (let row = 0; row < IDENTICON_SIZE; row++) {
      // Drawn on the left half only, then mirrored to keep the pattern
      // symmetric like GitHub's identicons.
      if (random() < 0.5) continue
      cells[row * IDENTICON_SIZE + column] = true
      cells[row * IDENTICON_SIZE + (IDENTICON_SIZE - 1 - column)] = true
    }
  }

  // A fully empty grid would render as a blank tile; keep the middle column.
  if (!cells.some(Boolean)) {
    for (let row = 0; row < IDENTICON_SIZE; row++) {
      cells[row * IDENTICON_SIZE + Math.floor(IDENTICON_SIZE / 2)] = true
    }
  }

  return cells
}

/** Tile and block colours for {@link getUserIdenticonCells}. */
export function getUserIdenticonColors(name: string): {
  background: string
  foreground: string
} {
  const hue = hashString(name.trim().toLowerCase()) % 360
  return {
    background: `hsl(${hue} 44% 94%)`,
    foreground: `hsl(${hue} 58% 42%)`,
  }
}
