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
 * Shape (the current form stores an array; a single object remains accepted
 * for backwards compatibility):
 * ```json
 * [{
 *   "id": "deepseek-half-price",
 *   "enabled": true,
 *   "title": "DeepSeek 全线限时半价",
 *   "expiresAt": "2026-10-01T23:59:00+08:00",
 *   "discount": 0.5,
 *   "models": ["deepseek*"]
 * }]
 * ```
 */

export type PromoPricing = {
  /** Stable editor key. Older single-campaign values may omit it. */
  id?: string
  enabled: boolean
  title: string
  /** RFC3339 timestamp; empty string means "no deadline". */
  expiresAt: string
  /** Displayed price multiplier, `0 <= discount <= 1` (0 = free, 0.5 = half price). */
  discount: number
  /** Model names or `*` patterns matched case-insensitively. */
  models: string[]
}

export type PromoPricingConfig = PromoPricing[]

export const DEFAULT_PROMO_DISCOUNT = 0.5

/** Parse a discount multiplier, rejecting values outside `[0, 1]`. */
function normalizeDiscount(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value.trim()) : value
  if (typeof num !== 'number' || !Number.isFinite(num)) return undefined
  if (num < 0 || num > 1) return undefined
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
export function parsePromoPricing(raw: unknown): PromoPricingConfig {
  if (raw === null || raw === undefined) return []

  let value: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      value = JSON.parse(trimmed)
    } catch {
      return []
    }
  }

  if (typeof value !== 'object' || value === null) return []

  const records = Array.isArray(value) ? value : [value]
  return records.flatMap((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return []
    }
    const record = item as Record<string, unknown>
    return [
      {
        id: normalizeText(record.id) || `campaign-${index + 1}`,
        enabled: record.enabled === true || record.enabled === 'true',
        title: normalizeText(record.title),
        expiresAt: normalizeText(record.expiresAt),
        discount:
          normalizeDiscount(record.discount) ?? DEFAULT_PROMO_DISCOUNT,
        models: normalizeModels(record.models),
      },
    ]
  })
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

export function getActivePromoPricings(
  promos: PromoPricing[] | null,
  now: number = Date.now()
): PromoPricing[] {
  return (promos ?? []).filter((promo) => isPromoPricingActive(promo, now))
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
  promos: PromoPricing[] | PromoPricing | null,
  modelName: string | undefined,
  now: number = Date.now()
): number | undefined {
  return getPromoPricingForModel(promos, modelName, now)?.discount
}

export function getPromoPricingForModel(
  promos: PromoPricing[] | PromoPricing | null,
  modelName: string | undefined,
  now: number = Date.now()
): PromoPricing | undefined {
  const campaigns = Array.isArray(promos) ? promos : promos ? [promos] : []
  const matches = campaigns.filter(
    (promo) =>
      isPromoPricingActive(promo, now) && matchesPromoModel(promo, modelName)
  )
  if (matches.length === 0) return undefined

  // Exact model names win over wildcards; among wildcard matches, the longer
  // pattern is more specific. This makes overlapping campaigns predictable.
  const normalizedName = modelName?.trim().toLowerCase() ?? ''
  const score = (promo: PromoPricing) =>
    Math.max(
      ...promo.models.map((pattern) => {
        const normalized = pattern.trim().toLowerCase()
        if (normalized === normalizedName) return 1_000_000 + normalized.length
        return (normalized.replaceAll('*', '').length || 0) * 1000
      })
    )
  return matches.sort((a, b) => score(b) - score(a))[0]
}

export function getPromoCampaignsForModel(
  promos: PromoPricing[] | null,
  modelName: string | undefined,
  now: number = Date.now()
): PromoPricing[] {
  return getActivePromoPricings(promos, now).filter((promo) =>
    matchesPromoModel(promo, modelName)
  )
}

/** Discount expressed as a percentage off, e.g. `0.5` → `50`. */
export function getPromoOffPercent(discount: number): number {
  return Math.max(0, Math.round((1 - discount) * 100))
}
