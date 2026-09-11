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
 * The single OIDC provider behind this deployment is Google, so every
 * user-facing surface shows that brand name instead of the upstream "OIDC"
 * placeholder. The admin console keeps the generic OIDC terminology because
 * the settings there configure the protocol, not the brand.
 */
export const OIDC_DISPLAY_NAME = 'Google'

/**
 * Resolves the provider name shown to end users. An admin-configured display
 * name wins unless it is unset or still carries the upstream placeholder.
 */
export function resolveOidcDisplayName(configuredName?: string | null): string {
  const trimmed = configuredName?.trim()
  if (!trimmed || trimmed.toLowerCase() === 'oidc') {
    return OIDC_DISPLAY_NAME
  }
  return trimmed
}
