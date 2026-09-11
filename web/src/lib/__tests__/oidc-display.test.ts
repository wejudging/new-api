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
import { describe, expect, test } from 'vitest'

import { OIDC_DISPLAY_NAME, resolveOidcDisplayName } from '../oidc-display'

describe('resolveOidcDisplayName', () => {
  test('falls back to the Google brand when the deployment has no display name', () => {
    expect(resolveOidcDisplayName()).toBe(OIDC_DISPLAY_NAME)
    expect(resolveOidcDisplayName(null)).toBe(OIDC_DISPLAY_NAME)
    expect(resolveOidcDisplayName('')).toBe(OIDC_DISPLAY_NAME)
    expect(resolveOidcDisplayName('   ')).toBe(OIDC_DISPLAY_NAME)
  })

  test('replaces the upstream OIDC placeholder regardless of casing', () => {
    expect(resolveOidcDisplayName('OIDC')).toBe(OIDC_DISPLAY_NAME)
    expect(resolveOidcDisplayName(' oidc ')).toBe(OIDC_DISPLAY_NAME)
  })

  test('keeps an operator-configured provider name verbatim', () => {
    expect(resolveOidcDisplayName('Google Workspace')).toBe('Google Workspace')
    expect(resolveOidcDisplayName('  Acme SSO  ')).toBe('Acme SSO')
  })
})
