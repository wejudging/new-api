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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AuthenticatedLayout, Main, PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { useAuthStore } from '@/stores/auth-store'

import {
  LoadingSkeleton,
  EmptyState,
  PricingTable,
  ModelDetailsDrawer,
  VendorFilterBar,
} from './components'
import { VIEW_MODES } from './constants'
import { useFilters } from './hooks/use-filters'
import { useModelPerf } from './hooks/use-model-perf'
import { usePricingData } from './hooks/use-pricing-data'

export function Pricing() {
  const { t } = useTranslation()
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )
  // Signed-in visitors get the console shell, guests keep the public page.
  const user = useAuthStore((state) => state.auth.user)
  const inShell = Boolean(user)

  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const {
    vendorFilter,
    groupFilter,
    tokenUnit,
    showRechargePrice,
    setVendorFilter,
    filteredModels,
    hasActiveFilters,
    clearFilters,
  } = useFilters(models || [])

  const perfByModel = useModelPerf()

  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName)
  }, [])

  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? (models || []).find(
            (model) => model.model_name === selectedModelName
          ) || null
        : null,
    [models, selectedModelName]
  )

  const renderPricingContent = () => {
    if (filteredModels.length === 0) {
      return (
        <EmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )
    }

    return (
      <PricingTable
        models={filteredModels}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showRechargePrice}
        selectedGroup={groupFilter}
        onModelClick={handleModelClick}
        perfByModel={perfByModel}
      />
    )
  }

  const pageBody = (
    <>
      <main className='min-w-0 space-y-4'>
        <VendorFilterBar
          vendors={vendors || []}
          models={models || []}
          value={vendorFilter}
          onChange={setVendorFilter}
        />

        {renderPricingContent()}
      </main>

      {selectedModel && (
        <ModelDetailsDrawer
          open={Boolean(selectedModel)}
          onOpenChange={(open) => {
            if (!open) setSelectedModelName(null)
          }}
          model={selectedModel}
          groupRatio={groupRatio || {}}
          usableGroup={usableGroup || {}}
          endpointMap={
            (endpointMap as Record<string, { path?: string; method?: string }>) ||
            {}
          }
          autoGroups={autoGroups || []}
          priceRate={priceRate ?? 1}
          usdExchangeRate={usdExchangeRate ?? 1}
          tokenUnit={tokenUnit}
          showRechargePrice={showRechargePrice}
        />
      )}
    </>
  )

  if (isLoading) {
    const skeleton = (
      <div
        className={
          inShell
            ? 'px-4 py-4'
            : 'mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'
        }
      >
        <LoadingSkeleton viewMode={VIEW_MODES.TABLE} />
      </div>
    )

    return inShell ? (
      <AuthenticatedLayout>
        <Main>
          <div className='hover-scrollbar min-h-0 flex-1 overflow-y-auto'>
            {skeleton}
          </div>
        </Main>
      </AuthenticatedLayout>
    ) : (
      <PublicLayout showMainContainer={false}>{skeleton}</PublicLayout>
    )
  }

  const body = (
    <div className='relative'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-15 dark:opacity-[0.08]'
        style={{
          background: [
            'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 35% at 50% 70%, oklch(0.70 0.12 280 / 40%) 0%, transparent 70%)',
          ].join(', '),
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 40%, transparent 100%)',
        }}
      />
      <PageTransition
        className={
          inShell
            ? 'relative mx-auto w-full max-w-[1800px] px-4 py-4'
            : 'relative mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'
        }
      >
        <h1 className='sr-only'>{t('Model Square')}</h1>
        {pageBody}
      </PageTransition>
    </div>
  )

  if (inShell) {
    return (
      <AuthenticatedLayout>
        <Main>
          <div className='hover-scrollbar min-h-0 flex-1 overflow-y-auto'>
            {body}
          </div>
        </Main>
      </AuthenticatedLayout>
    )
  }

  return <PublicLayout showMainContainer={false}>{body}</PublicLayout>
}
