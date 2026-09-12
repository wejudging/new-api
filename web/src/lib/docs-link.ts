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
import { DEFAULT_DOCS_URL } from './constants'

/** Hosts that belong to the upstream project documentation site. */
const UPSTREAM_DOCS_HOSTS = ['newapi.pro']

/**
 * Resolve the documentation link shown in the UI.
 *
 * The deployment ships its own documentation site, so an unset value — or a
 * value still pointing at the upstream project docs — falls back to it.
 */
export function resolveDocsUrl(configured?: string | null): string {
  const value = (configured ?? '').trim()
  if (!value) return DEFAULT_DOCS_URL

  try {
    const host = new URL(value).hostname.toLowerCase()
    const isUpstream = UPSTREAM_DOCS_HOSTS.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    )
    return isUpstream ? DEFAULT_DOCS_URL : value
  } catch {
    return value
  }
}
