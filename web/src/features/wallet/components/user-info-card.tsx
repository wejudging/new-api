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
        <CardContent className='p-3 sm:p-5'>
          <div className='flex items-center gap-3 sm:gap-4'>
            <Skeleton className='h-12 w-12 rounded-md sm:h-16 sm:w-16 sm:rounded-lg' />
            <div className='space-y-2.5'>
              <Skeleton className='h-6 w-40 sm:h-7' />
              <Skeleton className='h-4 w-56' />
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
      <CardContent className='p-3 sm:p-5'>
        <div className='flex items-center gap-3 text-left sm:gap-4'>
          <Avatar className='ring-background h-12 w-12 rounded-md text-sm ring-2 after:rounded-md sm:h-16 sm:w-16 sm:rounded-lg sm:text-lg sm:ring-4 sm:after:rounded-lg'>
            <AvatarFallback className='overflow-hidden rounded-md sm:rounded-lg'>
              <GitHubIdenticon name={avatarName} />
            </AvatarFallback>
          </Avatar>

          <div className='min-w-0 flex-1 space-y-1 sm:space-y-1.5'>
            <h1 className='truncate text-xl font-semibold tracking-tight sm:text-2xl'>
              {user.username}
            </h1>
            {user.email && (
              <div className='text-muted-foreground truncate text-xs sm:text-sm'>
                {user.email}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
