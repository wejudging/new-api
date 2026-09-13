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
import { useMemo } from 'react'

import {
  getUserIdenticonCells,
  getUserIdenticonColors,
  IDENTICON_SIZE,
} from '@/lib/avatar'
import { cn } from '@/lib/utils'

interface GitHubIdenticonProps {
  /** Account name the picture is derived from; the same name is stable. */
  name: string
  className?: string
}

/**
 * GitHub-style generated avatar: a mirrored 5×5 block pattern whose hue is
 * derived from the account name. Purely decorative — the surrounding UI
 * (avatar with an accessible label, or adjacent text) carries the meaning.
 */
export function GitHubIdenticon({ name, className }: GitHubIdenticonProps) {
  const cells = useMemo(() => getUserIdenticonCells(name), [name])
  const colors = useMemo(() => getUserIdenticonColors(name), [name])

  return (
    <svg
      data-slot='github-identicon'
      aria-hidden='true'
      className={cn('size-full', className)}
      viewBox={`0 0 ${IDENTICON_SIZE} ${IDENTICON_SIZE}`}
      preserveAspectRatio='xMidYMid slice'
      shapeRendering='crispEdges'
    >
      <rect
        width={IDENTICON_SIZE}
        height={IDENTICON_SIZE}
        fill={colors.background}
      />
      {cells.map((filled, index) => {
        if (!filled) return null
        const x = index % IDENTICON_SIZE
        const y = Math.floor(index / IDENTICON_SIZE)
        return (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={1}
            height={1}
            fill={colors.foreground}
          />
        )
      })}
    </svg>
  )
}
