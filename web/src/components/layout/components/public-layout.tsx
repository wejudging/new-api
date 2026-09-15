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
import { AnnouncementBanner } from '@/components/announcement-banner'
import { useAnnouncementBanner } from '@/hooks/use-announcement-banner'

import type { TopNavLink } from '../types'
import { PublicHeader, type PublicHeaderProps } from './public-header'

type PublicLayoutProps = {
  children: React.ReactNode
  showMainContainer?: boolean
  navContent?: React.ReactNode
  headerProps?: Omit<PublicHeaderProps, 'navContent'>
  navLinks?: TopNavLink[]
  showThemeSwitch?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  logo?: React.ReactNode
  siteName?: string
}

export function PublicLayout(props: PublicLayoutProps) {
  const banner = useAnnouncementBanner()

  return (
    <div className='bg-background text-foreground relative min-h-svh overflow-x-clip'>
      <AnnouncementBanner
        items={banner.items}
        visible={banner.visible}
        onDismiss={banner.dismiss}
        className='fixed inset-x-0 top-0 z-60'
      />
      <PublicHeader
        navContent={props.navContent}
        navLinks={props.navLinks}
        showThemeSwitch={props.showThemeSwitch}
        showAuthButtons={props.showAuthButtons}
        showNotifications={props.showNotifications}
        logo={props.logo}
        siteName={props.siteName}
        topOffset={banner.height}
        {...props.headerProps}
      />

      {props.showMainContainer !== false ? (
        <main
          className='container px-4 py-6 pt-20 md:px-4'
          style={{ paddingTop: `calc(5rem + ${banner.height})` }}
        >
          {props.children}
        </main>
      ) : (
        props.children
      )}
    </div>
  )
}
