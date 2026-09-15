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
import type { CheckinLotteryDrawResult } from '../types'
import { CHECKIN_LOTTERY_QUERY_KEY } from './use-checkin-lottery'

/**
 * How long the roll keeps spinning before the prize is revealed. The API
 * normally answers in a few hundred milliseconds, so without a floor the
 * highlight would blink once and jump straight to the result, which reads as
 * a glitch rather than a draw.
 */
const MIN_DRAW_ANIMATION_MS = 2600

/** Highlight speed at the start and at the end of the roll, in milliseconds. */
const ROLL_START_INTERVAL_MS = 70
const ROLL_END_INTERVAL_MS = 260

/** Resolves after `ms`, used to hold the reveal until the roll has played. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isTurnstileError(message?: string): boolean {
  return typeof message === 'string' && message.includes('Turnstile')
}

interface UseCheckinDrawOptions {
  /** Number of prize tiers, used to cycle the rolling highlight. */
  prizeCount: number
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
  const [result, setResult] = useState<CheckinLotteryDrawResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [turnstileOpen, setTurnstileOpen] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const turnstileEnabled = Boolean(status?.turnstile_check)
  const turnstileSiteKey = String(status?.turnstile_site_key ?? '')

  useEffect(() => {
    if (!drawing) {
      setRollingIndex(null)
      return
    }
    const count = optionsRef.current.prizeCount
    if (count <= 0) return
    const startedAt = Date.now()
    let timer = 0
    const roll = () => {
      setRollingIndex((current) => {
        const next = current == null ? 0 : current + 1
        return next % count
      })
      const progress = Math.min(
        (Date.now() - startedAt) / MIN_DRAW_ANIMATION_MS,
        1
      )
      // Ease out: sprint through the pool first, then glide to a stop so the
      // reveal lands as a punchline instead of an instant flash.
      const delay =
        ROLL_START_INTERVAL_MS +
        (ROLL_END_INTERVAL_MS - ROLL_START_INTERVAL_MS) * progress ** 2
      timer = window.setTimeout(roll, delay)
    }
    timer = window.setTimeout(roll, ROLL_START_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [drawing])

  const draw = useCallback(
    async (turnstileToken?: string) => {
      setDrawing(true)
      setErrorMessage(null)
      // Start the roll timer next to the request: the reveal waits for
      // whichever finishes last, so a fast API still shows the full animation.
      const reveal = sleep(MIN_DRAW_ANIMATION_MS)
      try {
        const res = await drawCheckinLottery(turnstileToken)
        if (res.success && res.data) {
          const drawn = res.data
          await reveal
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
        setDrawing(false)
      }
    },
    [queryClient, t, turnstileSiteKey]
  )

  const resetResult = useCallback(() => {
    setResult(null)
    setErrorMessage(null)
  }, [])

  return {
    draw,
    drawing,
    rollingIndex,
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
