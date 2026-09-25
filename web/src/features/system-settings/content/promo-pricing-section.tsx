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
import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/datetime-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { handleServerError } from '@/lib/handle-server-error'
import {
  DEFAULT_PROMO_DISCOUNT,
  PROMO_COLORS,
  parsePromoPricing,
  type PromoColor,
  type PromoPricingConfig,
  type PromoPricing,
} from '@/lib/promo-pricing'
import { cn } from '@/lib/utils'

import { SettingsSwitchField } from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type PromoPricingSectionProps = {
  data: string
}

type PromoPricingForm = Omit<PromoPricing, 'discount'> & {
  /** Discount multiplier entered as a price percentage: 0 = free, 50 = half. */
  discountPercent: string
  modelsText: string
}

function toForm(promo: PromoPricing, index: number): PromoPricingForm {
  return {
    id: promo.id || `campaign-${index + 1}`,
    enabled: promo.enabled,
    title: promo.title,
    discountPercent: String(Math.round(promo.discount * 100)),
    models: promo.models,
    modelsText: promo.models.join(', '),
    expiresAt: promo.expiresAt,
  }
}

function createCampaign(index: number): PromoPricingForm {
  return {
    id: `campaign-${Date.now()}-${index + 1}`,
    enabled: true,
    title: '',
    discountPercent: String(Math.round(DEFAULT_PROMO_DISCOUNT * 100)),
    models: [],
    modelsText: '',
    expiresAt: '',
  }
}

/** Swatch backgrounds; literal strings so Tailwind keeps them. */
const PROMO_SWATCH: Record<PromoColor, string> = {
  red: 'bg-red-600',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-600',
  sky: 'bg-sky-600',
  violet: 'bg-violet-600',
  slate: 'bg-slate-700',
}

function toOptionValue(campaigns: PromoPricingForm[]): string {
  const value: PromoPricingConfig = campaigns.map((campaign) => {
    const discountPercent = Number(campaign.discountPercent)
    const normalizedDiscountPercent =
      Number.isFinite(discountPercent) &&
      discountPercent >= 0 &&
      discountPercent <= 100
        ? discountPercent
        : Math.round(DEFAULT_PROMO_DISCOUNT * 100)
    const models = campaign.modelsText
      .split(/[\s,，;；]+/)
      .map((item) => item.trim())
      .filter(Boolean)

    return {
      id: campaign.id,
      enabled: campaign.enabled,
      title: campaign.title.trim(),
      expiresAt: campaign.expiresAt,
      discount: Number((normalizedDiscountPercent / 100).toFixed(4)),
      models,
    }
  })
  return JSON.stringify(value)
}

/**
 * Limited-time campaign editor: the campaign is stored as JSON in the
 * `PromoPricing` option and pushed to every visitor through `/api/status`.
 */
export function PromoPricingSection(props: PromoPricingSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const parsed = useMemo(() => parsePromoPricing(props.data), [props.data])
  const [campaigns, setCampaigns] = useState<PromoPricingForm[]>(() =>
    parsed.map(toForm)
  )

  useEffect(() => {
    setCampaigns(parsePromoPricing(props.data).map(toForm))
  }, [props.data])

  const update = <K extends keyof PromoPricingForm>(
    index: number,
    key: K,
    value: PromoPricingForm[K]
  ) =>
    setCampaigns((prev) =>
      prev.map((campaign, campaignIndex) =>
        campaignIndex === index ? { ...campaign, [key]: value } : campaign
      )
    )

  const handleSave = async () => {
    try {
      await updateOption.mutateAsync({
        key: 'PromoPricing',
        value: toOptionValue(campaigns),
      })
      toast.success(t('Setting saved'))
    } catch (error) {
      handleServerError(error, t('Failed to update setting'))
    }
  }

  return (
    <SettingsSection title={t('Limited-time Pricing')}>
      <div className='space-y-4'>
        {campaigns.length === 0 ? (
          <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
            {t('No campaigns configured. Click Add campaign to get started.')}
          </p>
        ) : null}

        {campaigns.map((campaign, index) => {
          const discountPercent = Number(campaign.discountPercent)
          const discount =
            Number.isFinite(discountPercent) &&
            discountPercent >= 0 &&
            discountPercent <= 100
              ? discountPercent / 100
              : DEFAULT_PROMO_DISCOUNT
          return (
            <div key={campaign.id} className='space-y-4 rounded-lg border p-4'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <SettingsSwitchField
                  checked={campaign.enabled}
                  onCheckedChange={(checked) => update(index, 'enabled', checked)}
                  label={campaign.title || t('Untitled campaign')}
                  description={t(
                    'Only matching models receive this campaign price. A 100% discount is limited-time free.'
                  )}
                />
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='text-destructive hover:text-destructive'
                  onClick={() =>
                    setCampaigns((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className='mr-2 size-4' />
                  {t('Remove')}
                </Button>
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor={`promo-title-${index}`}>{t('Campaign title')}</Label>
                  <Input
                    id={`promo-title-${index}`}
                    value={campaign.title}
                    placeholder={t('DeepSeek limited-time half price')}
                    onChange={(event) => update(index, 'title', event.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor={`promo-off-${index}`}>{t('Price discount (%)')}</Label>
                  <Input
                    id={`promo-off-${index}`}
                    type='number'
                    min={0}
                    max={100}
                    value={campaign.discountPercent}
                    onChange={(event) => update(index, 'discountPercent', event.target.value)}
                  />
                  <p className='text-muted-foreground text-xs'>
                    {t('0% means limited-time free; 50% means half price; 100% means regular price.')}
                  </p>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor={`promo-models-${index}`}>{t('Models')}</Label>
                  <Input
                    id={`promo-models-${index}`}
                    value={campaign.modelsText}
                    placeholder='big-pickle, ling-3.0, nemotron-*'
                    onChange={(event) => update(index, 'modelsText', event.target.value)}
                  />
                  <p className='text-muted-foreground text-xs'>
                    {t('Comma separated model names, wildcards supported.')}
                  </p>
                </div>

                <div className='space-y-2'>
                  <Label>{t('Ends at')}</Label>
                  <DateTimePicker
                    value={campaign.expiresAt ? new Date(campaign.expiresAt) : undefined}
                    onChange={(date) => update(index, 'expiresAt', date ? date.toISOString() : '')}
                    placeholder={t('No deadline')}
                  />
                </div>
              </div>

              <p className='text-muted-foreground text-xs'>
                {t('Pricing page preview:')}{' '}
                <span className='line-through'>$1.00</span>{' '}
                <span className='font-semibold text-red-500'>
                  {discount === 0 ? t('FREE') : `$${discount.toFixed(2)}`}
                </span>{' '}
                · {discount === 0 ? t('Limited-time free') : t('Price at {{percent}}%', { percent: discountPercent })}
              </p>

              <div className='space-y-2'>
                <Label>{t('Banner colour')}</Label>
                <div className='flex flex-wrap items-center gap-2'>
                  {PROMO_COLORS.map((color) => (
                    <button
                      key={color}
                      type='button'
                      aria-label={color}
                      title={color}
                      onClick={() => update(index, 'color', color)}
                      className={cn(
                        'size-6 rounded-full ring-2 ring-offset-1 ring-offset-background transition',
                        PROMO_SWATCH[color],
                        (campaign.color ?? 'red') === color
                          ? 'ring-foreground'
                          : 'ring-transparent'
                      )}
                    />
                  ))}
                </div>
                <p className='text-muted-foreground text-xs'>
                  {t('Each campaign keeps its own banner colour.')}
                </p>
              </div>
            </div>
          )
        })}

        <Button
          type='button'
          variant='outline'
          onClick={() => setCampaigns((prev) => [...prev, createCampaign(prev.length)])}
        >
          <Plus className='mr-2 size-4' />
          {t('Add campaign')}
        </Button>

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Button
            onClick={handleSave}
            size='sm'
            variant='secondary'
            disabled={updateOption.isPending}
          >
            <Save className='mr-2 h-4 w-4' />
            {updateOption.isPending ? t('Saving...') : t('Save Settings')}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
