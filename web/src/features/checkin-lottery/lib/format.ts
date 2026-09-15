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
 * Format a prize amount for display.
 *
 * Prize amounts are configured in CNY yuan, so they are rendered verbatim
 * with the `¥` symbol instead of going through the quota display settings.
 */
export function formatYuan(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '-'
  return `¥${amount.toFixed(2)}`
}

/** Ordinal-safe rank label, e.g. `#4`. */
export function formatRank(rank: number): string {
  if (!rank || rank < 1) return '-'
  return `#${rank}`
}
