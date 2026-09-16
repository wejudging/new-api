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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PrizeBoard } from '../../components/prize-board'
import type { CheckinLotteryPrize } from '../../types'
import {
  findPrizeIndex,
  landingSteps,
  startPrizeRoll,
  useCheckinDraw,
} from '../use-checkin-draw'

const { drawCheckinLottery } = vi.hoisted(() => ({
  drawCheckinLottery: vi.fn(),
}))

vi.mock('../../api', () => ({ drawCheckinLottery }))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: {} }),
}))

/** Small pool, so the tier a draw is expected to land on stays readable. */
const prizes: CheckinLotteryPrize[] = [
  { amount: 0.01, weight: 5000, probability: 0.5 },
  { amount: 0.05, weight: 2500, probability: 0.25 },
  { amount: 0.2, weight: 2000, probability: 0.2 },
  { amount: 0.5, weight: 500, probability: 0.05 },
]

/** Last state the harness rendered, so a test can drive the draw itself. */
let board: ReturnType<typeof useCheckinDraw> | null = null

/** What the board was showing on every commit of the draw animation. */
let frames: Array<{
  rolling: number | null
  won: number | null
  amount: number | null
}>

function drawResponse(amount: number) {
  return {
    success: true,
    data: {
      amount,
      quota: Math.round(amount * 500000),
      tickets: 0,
      checked_in_today: true,
      stats: { total_draws: 1, total_amount: amount, best_amount: amount },
      rank: 1,
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  drawCheckinLottery.mockReset()
  board = null
  frames = []
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ============================================================================
// The roll engine
// ============================================================================

/** Every tier the roll highlighted, with the virtual timestamp of each step. */
interface Emission {
  index: number
  at: number
}

interface RecordedRoll {
  emissions: Emission[]
  /** Milliseconds the roll took to finish, or `null` while it is still going. */
  finishedAt: () => number | null
  land: (index: number) => void
  cancel: () => void
}

function recordRoll(count: number, startIndex = -1): RecordedRoll {
  const emissions: Emission[] = []
  const startedAt = Date.now()
  const finished: { at: number | null } = { at: null }
  const roll = startPrizeRoll({
    count,
    startIndex,
    onIndex: (index) => emissions.push({ index, at: Date.now() - startedAt }),
  })
  void roll.finished.then(() => {
    finished.at = Date.now() - startedAt
  })
  return {
    emissions,
    finishedAt: () => finished.at,
    land: (index) => roll.land(index),
    cancel: () => roll.cancel(),
  }
}

/** Advances the fake clock far enough for any roll to complete. */
async function settle(ms = 20000) {
  await vi.advanceTimersByTimeAsync(ms)
}

function lastIndex(emissions: Emission[]): number | undefined {
  return emissions.at(-1)?.index
}

/** Gaps between consecutive highlights. */
function gaps(emissions: Emission[]): number[] {
  return emissions
    .slice(1)
    .map((emission, index) => emission.at - emissions[index].at)
}

/**
 * Gaps of the final approach to the winning tier: the longest tail of the
 * roll whose steps keep getting slower, which is what the landing phase is.
 */
function landingGaps(emissions: Emission[]): number[] {
  const deltas = gaps(emissions)
  let start = deltas.length - 1
  while (start > 0 && deltas[start] >= deltas[start - 1]) {
    start -= 1
  }
  return deltas.slice(start)
}

describe('startPrizeRoll', () => {
  it('stops the highlight on the tier the backend drew', async () => {
    const roll = recordRoll(12)
    roll.land(4)
    await settle()

    expect(lastIndex(roll.emissions)).toBe(4)
    expect(roll.finishedAt()).not.toBeNull()
  })

  it('visits every tier on the way, so the board looks like it is rolling', async () => {
    const roll = recordRoll(12)
    roll.land(7)
    await settle()

    const visited = new Set(roll.emissions.map((emission) => emission.index))
    expect(visited.size).toBe(12)
    // Tiers are highlighted one after the other, wrapping around the board.
    expect(
      roll.emissions.slice(0, 4).map((emission) => emission.index)
    ).toEqual([0, 1, 2, 3])
  })

  it('keeps spinning while the backend is still thinking, then lands', async () => {
    const roll = recordRoll(12)
    window.setTimeout(() => roll.land(3), 2200)
    await settle()

    expect(lastIndex(roll.emissions)).toBe(3)
    // The highlight never stopped while the request was in flight.
    const beforeLanding = roll.emissions.filter(
      (emission) => emission.at < 2200
    )
    expect(beforeLanding.length).toBeGreaterThan(20)
  })

  it('decelerates over the landing instead of jumping onto the tier', async () => {
    const roll = recordRoll(12)
    roll.land(9)
    await settle()

    const approach = landingGaps(roll.emissions)
    // The landing always travels at least eight tiers, the last being the stop.
    expect(approach.length).toBeGreaterThanOrEqual(7)
    // Every step is at least as slow as the previous one, and the roll ends
    // up markedly slower than the fast phase.
    expect(approach.at(-1)).toBeGreaterThan(approach[0])
  })

  it('rests on the winning tier before finishing', async () => {
    const roll = recordRoll(12)
    roll.land(1)
    await settle()

    const lastAt = roll.emissions.at(-1)?.at ?? 0
    const finishedAt = roll.finishedAt()
    expect(finishedAt).not.toBeNull()
    // The result is only revealed after the highlight has rested on the tier.
    expect((finishedAt ?? 0) - lastAt).toBeGreaterThanOrEqual(400)
  })

  it('takes a couple of seconds end to end', async () => {
    const roll = recordRoll(12)
    roll.land(5)
    await settle()

    const finishedAt = roll.finishedAt() ?? 0
    expect(finishedAt).toBeGreaterThanOrEqual(2600)
    expect(finishedAt).toBeLessThanOrEqual(4000)
  })

  it('stops emitting and finishes when it is cancelled', async () => {
    const roll = recordRoll(12)
    window.setTimeout(() => roll.cancel(), 500)
    await settle(1000)

    const emissionsWhenCancelled = roll.emissions.length
    expect(roll.finishedAt()).not.toBeNull()
    await settle(5000)
    expect(roll.emissions.length).toBe(emissionsWhenCancelled)
  })

  it('does nothing when the pool is empty', async () => {
    const roll = recordRoll(0)
    roll.land(0)
    await settle(5000)

    expect(roll.emissions).toEqual([])
    expect(roll.finishedAt()).toBe(0)
  })
})

describe('landingSteps', () => {
  it('always stops on the target tier, however far away it is', () => {
    for (const count of [4, 7, 12]) {
      for (let from = 0; from < count; from += 1) {
        for (let target = 0; target < count; target += 1) {
          const steps = landingSteps(from, target, count)
          expect((from + steps) % count).toBe(target)
          expect(steps).toBeGreaterThan(0)
        }
      }
    }
  })

  it('never lands on the tier it is already sitting on', () => {
    for (const count of [4, 12]) {
      for (let index = 0; index < count; index += 1) {
        const steps = landingSteps(index, index, count)
        // A full lap rather than a freeze on the tier the roll came from.
        expect(steps % count).toBe(0)
        expect(steps).toBeGreaterThanOrEqual(count)
        expect(steps).toBeGreaterThanOrEqual(8)
      }
    }
  })
})

describe('findPrizeIndex', () => {
  it('matches the drawn amount exactly when the pool still has that tier', () => {
    expect(findPrizeIndex(prizes, 0.05)).toBe(1)
    expect(findPrizeIndex(prizes, 0.5)).toBe(3)
  })

  it('falls back to the closest tier so the roll always has a landing spot', () => {
    expect(findPrizeIndex(prizes, 0.3)).toBe(2)
    expect(findPrizeIndex(prizes, 9)).toBe(3)
    expect(findPrizeIndex([], 0.2)).toBe(0)
  })
})

// ============================================================================
// The hook, wired to a real board
// ============================================================================

function renderBoard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Board() {
    const state = useCheckinDraw({ prizes })
    board = state
    frames.push({
      rolling: state.rollingIndex,
      won: state.wonIndex,
      amount: state.result?.amount ?? null,
    })
    return (
      <PrizeBoard
        prizes={prizes}
        rollingIndex={state.rollingIndex}
        wonIndex={state.wonIndex}
      />
    )
  }

  return render(
    <QueryClientProvider client={client}>
      <Board />
    </QueryClientProvider>
  )
}

/**
 * Runs a draw and lets the whole animation play out, sampling the board as it
 * commits. The draw is deliberately not wrapped in `act`: React queues every
 * update raised inside an act scope and commits them in one go, which would
 * hide exactly the bug these tests exist for, namely the tier the animation
 * stops on.
 */
async function playDraw(ticks = 140) {
  void board?.draw()
  for (let tick = 0; tick < ticks; tick += 1) {
    await vi.advanceTimersByTimeAsync(25)
  }
}

function highlightOf(amount: string): string {
  return screen.getByText(amount).className
}

describe('useCheckinDraw', () => {
  it('stops the roll on the tier that was actually drawn', async () => {
    drawCheckinLottery.mockResolvedValue(drawResponse(0.2))
    renderBoard()
    await playDraw()

    // The roll sweeps the whole pool, and the tier it stops on is the tier
    // that pays out, not wherever the animation happened to be.
    const highlighted = frames
      .map((frame) => frame.rolling)
      .filter((index): index is number => index !== null)
    expect(new Set(highlighted).size).toBe(prizes.length)
    expect(highlighted.at(-1)).toBe(2)
    expect(board?.wonIndex).toBe(2)
    expect(board?.rollingIndex).toBeNull()
    expect(board?.result?.amount).toBe(0.2)
    expect(board?.drawing).toBe(false)
    expect(highlightOf('¥0.20')).toContain('text-success')
    expect(highlightOf('¥0.01')).not.toContain('text-success')
  })

  it('lands on the closest tier when the pool no longer holds the drawn amount', async () => {
    drawCheckinLottery.mockResolvedValue(drawResponse(0.3))
    renderBoard()
    await playDraw()

    const highlighted = frames
      .map((frame) => frame.rolling)
      .filter((index): index is number => index !== null)
    expect(highlighted.at(-1)).toBe(2)
    expect(highlightOf('¥0.20')).toContain('text-success')
    expect(board?.wonIndex).toBe(2)
    expect(board?.result?.amount).toBe(0.3)
  })

  it('hides the result until the roll has stopped', async () => {
    drawCheckinLottery.mockResolvedValue(drawResponse(0.5))
    renderBoard()
    await playDraw()

    const revealedWhileRolling = frames.filter(
      (frame) => frame.rolling !== null && frame.amount !== null
    )
    expect(revealedWhileRolling).toEqual([])
    expect(frames.at(-1)).toEqual({
      rolling: null,
      won: 3,
      amount: 0.5,
    })
  })

  it('clears the highlight when the result is reset', async () => {
    drawCheckinLottery.mockResolvedValue(drawResponse(0.05))
    renderBoard()
    await playDraw()
    expect(highlightOf('¥0.05')).toContain('text-success')

    await act(async () => {
      board?.resetResult()
    })

    expect(highlightOf('¥0.05')).not.toContain('text-success')
    expect(board?.wonIndex).toBeNull()
  })

  it('leaves no highlight behind when the draw fails', async () => {
    drawCheckinLottery.mockResolvedValue({ success: false, message: 'nope' })
    renderBoard()
    await playDraw()

    expect(board?.wonIndex).toBeNull()
    expect(board?.rollingIndex).toBeNull()
    expect(highlightOf('¥0.01')).not.toContain('text-success')
  })
})
