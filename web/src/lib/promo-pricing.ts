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
 * Limited-time pricing campaigns ("promo pricing").
 *
 * The campaign is stored as a JSON string in the `PromoPricing` option and is
 * exposed to every visitor through `/api/status` (`promo_pricing`), so the
 * banner and the pricing page can discount prices without any extra request.
 *
 * Shape:
 * ```json
 * {
 *   "enabled": true,
 *   "title": "DeepSeek 全线限时半价",
 *   "expiresAt": "2026-10-01T23:59:00+08:00",
 *   "discount": 0.5,
 *   "models": ["deepseek*"]
 * }
 * ```
 */

export type PromoPricing = {
  enabled: boolean
  title: string
  /** RFC3339 timestamp; empty string means "no deadline". */
  expiresAt: string
  /** Displayed price multiplier, `0 < discount <= 1` (0.5 = half price). */
  discount: number
  /** Model names or `*` patterns matched case-insensitively. */
  models: string[]
}

export const DEFAULT_PROMO_DISCOUNT = 0.5

/** Parse a discount multiplier, rejecting values outside `(0, 1]`. */
function normalizeDiscount(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value.trim()) : value
  if (typeof num !== 'number' || !Number.isFinite(num)) return undefined
  if (num <= 0 || num > 1) return undefined
  return num
}

function normalizeModels(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const models: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    if (name) models.push(name)
  }

  return [...new Set(models)]
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Parse the raw option value. Accepts either a JSON string (option storage) or
 * an already-parsed object. Returns `null` when there is nothing usable.
 */
export function parsePromoPricing(raw: unknown): PromoPricing | null {
  if (raw === null || raw === undefined) return null

  let value: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      value = JSON.parse(trimmed)
    } catch {
      return null
    }
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>

  return {
    enabled: record.enabled === true || record.enabled === 'true',
    title: normalizeText(record.title),
    expiresAt: normalizeText(record.expiresAt),
    discount: normalizeDiscount(record.discount) ?? DEFAULT_PROMO_DISCOUNT,
    models: normalizeModels(record.models),
  }
}

/** Deadline timestamp in milliseconds, or `null` when unset/unparseable. */
export function getPromoExpiry(promo: PromoPricing | null): number | null {
  if (!promo?.expiresAt) return null
  const parsed = Date.parse(promo.expiresAt)
  return Number.isNaN(parsed) ? null : parsed
}

/** A campaign is active while it is enabled, matched to models and not expired. */
export function isPromoPricingActive(
  promo: PromoPricing | null,
  now: number = Date.now()
): promo is PromoPricing {
  if (!promo || !promo.enabled) return false
  if (promo.models.length === 0) return false

  const expiry = getPromoExpiry(promo)
  if (expiry !== null && expiry <= now) return false

  return true
}

function escapeRegExp(input: string): string {
  return input.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Pattern matching: exact name, `*` wildcard, or `*` for every model. */
export function matchesPromoModel(
  promo: PromoPricing | null,
  modelName: string | undefined
): boolean {
  if (!promo || !modelName) return false

  const name = modelName.trim().toLowerCase()
  if (!name) return false

  for (const pattern of promo.models) {
    const normalized = pattern.trim().toLowerCase()
    if (!normalized) continue
    if (normalized === '*') return true
    if (normalized === name) return true
    if (!normalized.includes('*')) continue

    const regex = new RegExp(
      `^${normalized.split('*').map(escapeRegExp).join('.*')}$`
    )
    if (regex.test(name)) return true
  }

  return false
}

/**
 * Discount to apply to the given model, or `undefined` when no active campaign
 * covers it.
 */
export function getPromoDiscountForModel(
  promo: PromoPricing | null,
  modelName: string | undefined,
  now: number = Date.now()
): number | undefined {
  if (!isPromoPricingActive(promo, now)) return undefined
  if (!matchesPromoModel(promo, modelName)) return undefined
  return promo.discount
}

/** Discount expressed as a percentage off, e.g. `0.5` → `50`. */
export function getPromoOffPercent(discount: number): number {
  return Math.max(0, Math.round((1 - discount) * 100))
}
