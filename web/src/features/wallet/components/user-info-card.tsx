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
import { GitHubIdenticon } from '@/components/github-identicon'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import type { UserWalletData } from '../types'

interface UserInfoCardProps {
  user: UserWalletData | null
  loading?: boolean
}

/**
 * Identity block for the signed-in user, shown at the top of the wallet page.
 *
 * Mirrors the old profile page header, minus the per-user group label: this
 * deployment only ships a single group, so the group would always read
 * "default".
 */
export function UserInfoCard(props: UserInfoCardProps) {
  if (props.loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardContent className='px-3 py-2.5 sm:px-4 sm:py-3'>
          <div className='flex items-center gap-2.5 sm:gap-3'>
            <Skeleton className='size-9 rounded-md sm:size-10' />
            <div className='flex min-w-0 flex-1 items-baseline gap-2'>
              <Skeleton className='h-5 w-28 sm:w-32' />
              <Skeleton className='h-3.5 w-40 sm:w-48' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!props.user) return null

  const user = props.user
  const avatarName = user.username || user.display_name || String(user.id)

  return (
    <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <CardContent className='px-3 py-2.5 sm:px-4 sm:py-3'>
        <div className='flex min-w-0 items-center gap-2.5 text-left sm:gap-3'>
          <Avatar className='ring-background size-9 rounded-md text-xs ring-2 after:rounded-md sm:size-10'>
            <AvatarFallback className='overflow-hidden rounded-md'>
              <GitHubIdenticon name={avatarName} />
            </AvatarFallback>
          </Avatar>

          {/* Name and email share one row to keep the header compact. */}
          <div className='flex min-w-0 flex-1 items-baseline gap-2'>
            <h1 className='truncate text-base font-semibold tracking-tight sm:text-lg'>
              {user.username}
            </h1>
            {user.email && (
              <span className='text-muted-foreground min-w-0 truncate text-xs sm:text-sm'>
                {user.email}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
