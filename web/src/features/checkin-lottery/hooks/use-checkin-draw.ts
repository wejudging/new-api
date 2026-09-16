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
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { handleServerError } from '@/lib/handle-server-error'
import { useAuthStore } from '@/stores/auth-store'

import { drawCheckinLottery } from '../api'
import type { CheckinLotteryDrawResult, CheckinLotteryPrize } from '../types'
import { CHECKIN_LOTTERY_QUERY_KEY } from './use-checkin-lottery'

/**
 * Speed of the first phase of the roll, in milliseconds per tier. The API
 * normally answers in a few hundred milliseconds, so the whole pool is spun
 * at this pace until `ROLL_MIN_SPIN_MS` has elapsed.
 */
const ROLL_SPIN_INTERVAL_MS = 80

/**
 * Floor for the fast phase. Without it a fast API would land almost
 * immediately and the draw would read as a glitch rather than a draw.
 */
const ROLL_MIN_SPIN_MS = 1300

/**
 * Total duration of the landing phase, in milliseconds. The roll slows down
 * over this window and stops exactly on the tier that was drawn.
 */
const ROLL_LANDING_MS = 1250

/** Shortest pause between two tiers during the landing phase, in milliseconds. */
const ROLL_LANDING_MIN_STEP_MS = 45

/**
 * The landing phase always travels at least this many tiers, so the
 * deceleration is long enough to read as "slowing down" instead of a jump.
 */
const ROLL_MIN_LANDING_STEPS = 8

/**
 * How long the highlight rests on the winning tier before the result is
 * revealed, in milliseconds.
 */
const ROLL_HOLD_MS = 450

/** A running prize roll: spin fast, then land on the tier the backend drew. */
export interface PrizeRoll {
  /** Resolves once the highlight has landed and rested on the winning tier. */
  finished: Promise<void>
  /** Aim the roll at `index`; safe to call before or during the fast phase. */
  land: (index: number) => void
  /** Abort the roll (unmount, or a draw that ends without a result). */
  cancel: () => void
}

/**
 * How many tiers the landing phase travels from `from` to `target`. Always a
 * positive number, and always a multiple of the pool size plus the offset, so
 * the roll stops on `target`.
 */
export function landingSteps(
  from: number,
  target: number,
  count: number
): number {
  const delta = (target - from + count) % count
  // Landing on the tier we already sit on would look like a freeze, so a full
  // lap is the minimum travel. Everything else keeps the same offset modulo
  // the pool size, which is what makes the roll stop on `target`.
  const base = delta === 0 ? count : delta
  const extraLaps = Math.max(
    0,
    Math.ceil((ROLL_MIN_LANDING_STEPS - base) / count)
  )
  return base + extraLaps * count
}

/**
 * Drive one roll of the prize board.
 *
 * The highlight used to be pure decoration: it kept cycling while the request
 * was in flight and then vanished wherever it happened to be, so the tier the
 * animation stopped on had nothing to do with the tier that was actually won.
 * Now the roll is aimed: it spins at full speed until `land()` reports the
 * drawn tier, then decelerates and stops on that exact tier.
 */
export function startPrizeRoll(config: {
  count: number
  /** Tier the highlight starts from, so a re-draw continues from the last stop. */
  startIndex: number
  onIndex: (index: number) => void
}): PrizeRoll {
  const { count, startIndex, onIndex } = config
  if (count <= 0) {
    return { finished: Promise.resolve(), land: () => {}, cancel: () => {} }
  }

  let cancelled = false
  let target: number | null = null
  let interrupt: (() => void) | null = null
  let resolveFinished: () => void = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })

  // The fast phase always waits out the step it is on, so the highlight keeps
  // an even rhythm; an interrupt only exists to cut a cancelled roll short.
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        interrupt = null
        resolve()
      }, ms)
      interrupt = () => {
        window.clearTimeout(id)
        interrupt = null
        resolve()
      }
    })

  const run = async () => {
    try {
      const startedAt = Date.now()
      let index = startIndex

      // Phase one: sprint through the pool until the backend has picked a
      // tier and the roll has been visible for long enough to feel like one.
      while (
        !cancelled &&
        (target === null || Date.now() - startedAt < ROLL_MIN_SPIN_MS)
      ) {
        index = (index + 1) % count
        onIndex(index)
        await wait(ROLL_SPIN_INTERVAL_MS)
      }
      if (cancelled || target === null) return

      // Phase two: ease out from the current tier onto the drawn tier. The
      // step count is picked so the highlight stops on `target`, and the
      // delays grow quadratically so the last few tiers crawl.
      const steps = landingSteps(index, target, count)
      const squares = (steps * (steps + 1) * (2 * steps + 1)) / 6
      const spread = Math.max(
        ROLL_LANDING_MS - ROLL_LANDING_MIN_STEP_MS * steps,
        0
      )
      for (let step = 1; step <= steps; step += 1) {
        index = (index + 1) % count
        onIndex(index)
        await wait(ROLL_LANDING_MIN_STEP_MS + (spread * step * step) / squares)
        if (cancelled) return
      }

      // Let the landing highlight sit on the winning tier for a beat before
      // the result takes over.
      await wait(ROLL_HOLD_MS)
    } finally {
      resolveFinished()
    }
  }

  void run()

  return {
    finished,
    land: (index: number) => {
      target = index
    },
    cancel: () => {
      cancelled = true
      interrupt?.()
      resolveFinished()
    },
  }
}

/**
 * Index of the tier that matches the drawn amount. Amounts are unique per
 * pool, so an exact match always exists; if the pool was edited between the
 * page load and the draw we fall back to the closest tier so the roll still
 * has somewhere to stop.
 */
export function findPrizeIndex(
  prizes: CheckinLotteryPrize[],
  amount: number
): number {
  if (prizes.length === 0) return 0
  const exact = prizes.findIndex((prize) => prize.amount === amount)
  if (exact >= 0) return exact
  let closest = 0
  let closestDiff = Number.POSITIVE_INFINITY
  prizes.forEach((prize, index) => {
    const diff = Math.abs(prize.amount - amount)
    if (diff < closestDiff) {
      closestDiff = diff
      closest = index
    }
  })
  return closest
}

function isTurnstileError(message?: string): boolean {
  return typeof message === 'string' && message.includes('Turnstile')
}

interface UseCheckinDrawOptions {
  /** Prize pool, used both to cycle the highlight and to aim the landing. */
  prizes: CheckinLotteryPrize[]
  /** Called after a successful draw so the page can play its reveal. */
  onSuccess?: (result: CheckinLotteryDrawResult) => void
}

/**
 * Owns the draw request, the "rolling" highlight shown while it is in
 * flight, the Turnstile handshake and the inline error message.
 */
export function useCheckinDraw(options: UseCheckinDrawOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { status } = useStatus()

  const [drawing, setDrawing] = useState(false)
  const [rollingIndex, setRollingIndex] = useState<number | null>(null)
  const [wonIndex, setWonIndex] = useState<number | null>(null)
  const [result, setResult] = useState<CheckinLotteryDrawResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [turnstileOpen, setTurnstileOpen] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)

  const optionsRef = useRef(options)
  optionsRef.current = options

  /** Tier the last roll stopped on, so a re-draw continues from there. */
  const lastIndexRef = useRef(-1)
  const rollRef = useRef<PrizeRoll | null>(null)

  const turnstileEnabled = Boolean(status?.turnstile_check)
  const turnstileSiteKey = String(status?.turnstile_site_key ?? '')

  useEffect(() => {
    return () => rollRef.current?.cancel()
  }, [])

  const draw = useCallback(
    async (turnstileToken?: string) => {
      setDrawing(true)
      setErrorMessage(null)
      const prizes = optionsRef.current.prizes
      const roll = startPrizeRoll({
        count: prizes.length,
        startIndex: lastIndexRef.current,
        onIndex: (index) => {
          lastIndexRef.current = index
          setRollingIndex(index)
        },
      })
      rollRef.current = roll
      try {
        const res = await drawCheckinLottery(turnstileToken)
        if (res.success && res.data) {
          const drawn = res.data
          // Aim the roll at the tier the backend drew before it can land, so
          // the tier the animation stops on is always the tier that was won.
          const prizeIndex = findPrizeIndex(prizes, drawn.amount)
          roll.land(prizeIndex)
          await roll.finished
          setRollingIndex(null)
          setWonIndex(prizeIndex)
          setResult(drawn)
          setTurnstileOpen(false)

          const store = useAuthStore.getState()
          const currentUser = store.auth.user
          if (currentUser) {
            store.auth.setUser({
              ...currentUser,
              quota: (currentUser.quota ?? 0) + drawn.quota,
            })
          }
          await queryClient.invalidateQueries({
            queryKey: CHECKIN_LOTTERY_QUERY_KEY,
          })
          optionsRef.current.onSuccess?.(drawn)
          return
        }

        if (isTurnstileError(res.message)) {
          if (!turnstileToken) {
            if (!turnstileSiteKey) {
              setErrorMessage(t('Turnstile is enabled but site key is empty.'))
              return
            }
            setTurnstileOpen(true)
            return
          }
          setTurnstileWidgetKey((value) => value + 1)
          setErrorMessage(res.message ?? t('Draw failed'))
          return
        }

        setErrorMessage(res.message ?? t('Draw failed'))
        handleServerError(res, t('Draw failed'))
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : t('Draw failed')
        )
        handleServerError(error, t('Draw failed'))
      } finally {
        rollRef.current = null
        roll.cancel()
        setRollingIndex(null)
        setDrawing(false)
      }
    },
    [queryClient, t, turnstileSiteKey]
  )

  const resetResult = useCallback(() => {
    setResult(null)
    setWonIndex(null)
    setErrorMessage(null)
  }, [])

  return {
    draw,
    drawing,
    rollingIndex,
    wonIndex,
    result,
    errorMessage,
    resetResult,
    turnstileEnabled,
    turnstileSiteKey,
    turnstileOpen,
    setTurnstileOpen,
    turnstileWidgetKey,
  }
}
