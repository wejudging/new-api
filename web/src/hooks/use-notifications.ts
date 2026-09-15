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
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useStatus } from '@/hooks/use-status'
import { getNotice } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useNotificationStore } from '@/stores/notification-store'

/**
 * Hook to manage notifications.
 *
 * The site notice feeds the bell popover; platform announcements are rendered
 * by the top banner row (see `useAnnouncementBanner`) and only read here so
 * both consumers share one `/api/status` subscription.
 */
export function useNotifications() {
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Fetch Notice from API
  const {
    data: noticeResponse,
    isLoading: noticeLoading,
    refetch: refetchNotice,
  } = useQuery({
    queryKey: ['notice'],
    queryFn: async () => requireServerSuccess(await getNotice()),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Fetch Announcements from status
  const { status, loading: statusLoading } = useStatus()
  const announcementsEnabled = status?.announcements_enabled ?? false
  const announcements = useMemo<Record<string, unknown>[]>(() => {
    if (!announcementsEnabled) return []
    return ((status?.announcements || []) as Record<string, unknown>[]).slice(
      0,
      20
    )
  }, [announcementsEnabled, status?.announcements])

  // Notification store
  const { lastReadNotice, markNoticeRead } = useNotificationStore()

  // Extract notice content
  const noticeContent = noticeResponse?.success
    ? (noticeResponse.data || '').trim()
    : ''

  const unreadCount = useMemo(() => {
    return noticeContent && noticeContent !== lastReadNotice ? 1 : 0
  }, [noticeContent, lastReadNotice])

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      if (noticeContent) {
        markNoticeRead(noticeContent)
      }
      setPopoverOpen(true)
      return
    }

    setPopoverOpen(false)
  }

  return {
    // Data
    notice: noticeContent,
    announcements,
    loading: noticeLoading || statusLoading,

    // Unread count
    unreadCount,

    // Popover state
    popoverOpen,
    setPopoverOpen: handlePopoverOpenChange,

    // Actions
    openPopover: () => handlePopoverOpenChange(true),
    closePopover: () => setPopoverOpen(false),
    refetchNotice,
  }
}
