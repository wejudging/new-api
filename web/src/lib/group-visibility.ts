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

/** The implicit group every deployment ships with. */
export const DEFAULT_GROUP_NAME = 'default'

/**
 * Whether the group concept carries no information for the given scope, so
 * user facing surfaces can hide it entirely. Deployments that only expose the
 * implicit default group — or no group at all — qualify.
 */
export function isSingleGroupScope(groups?: Iterable<string> | null): boolean {
  const names = [...(groups ?? [])]
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter(Boolean)

  if (names.length === 0) return true
  return names.length === 1 && names[0] === DEFAULT_GROUP_NAME
}
