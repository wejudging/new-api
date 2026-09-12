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
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { getRoleLabel } from '@/lib/roles'

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
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardContent className='p-3 sm:p-5'>
          <div className='flex items-center gap-3 sm:gap-4'>
            <Skeleton className='h-12 w-12 rounded-xl sm:h-16 sm:w-16 sm:rounded-2xl' />
            <div className='space-y-2.5'>
              <div className='flex items-center gap-2'>
                <Skeleton className='h-6 w-40 sm:h-7' />
                <Skeleton className='h-5 w-16' />
                <Skeleton className='h-5 w-24' />
              </div>
              <Skeleton className='h-4 w-56' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!props.user) return null

  const user = props.user
  const displayName = user.display_name || user.username
  const avatarName = user.username || displayName

  return (
    <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <CardContent className='p-3 sm:p-5'>
        <div className='flex items-center gap-3 text-left sm:gap-4'>
          <Avatar className='ring-background h-12 w-12 rounded-xl text-sm ring-2 sm:h-16 sm:w-16 sm:rounded-2xl sm:text-lg sm:ring-4'>
            <AvatarFallback
              className='rounded-xl font-semibold text-white sm:rounded-2xl'
              style={getUserAvatarStyle(avatarName)}
            >
              {getUserAvatarFallback(avatarName)}
            </AvatarFallback>
          </Avatar>

          <div className='min-w-0 flex-1 space-y-1.5 sm:space-y-3'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <h1 className='truncate text-xl font-semibold tracking-tight sm:text-2xl'>
                {displayName}
              </h1>
              <StatusBadge
                label={getRoleLabel(user.role)}
                variant='neutral'
                copyable={false}
              />
              <StatusBadge
                label={`${t('User ID')} ${user.id}`}
                variant='info'
                copyText={String(user.id)}
              />
            </div>

            <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:gap-x-4 sm:text-sm'>
              <span className='truncate'>@{user.username}</span>
              {user.email && (
                <>
                  <span>•</span>
                  <span className='truncate'>{user.email}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
