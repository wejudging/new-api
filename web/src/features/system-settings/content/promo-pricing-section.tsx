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
import { Save } from 'lucide-react'
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
  parsePromoPricing,
  type PromoPricing,
} from '@/lib/promo-pricing'

import { SettingsSwitchField } from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type PromoPricingSectionProps = {
  data: string
}

type PromoPricingForm = {
  enabled: boolean
  title: string
  /** Discount entered as a percentage off, e.g. `50` for half price. */
  offPercent: string
  models: string
  expiresAt: string
}

const DEFAULT_OFF_PERCENT = String(
  Math.round((1 - DEFAULT_PROMO_DISCOUNT) * 100)
)

function toForm(promo: PromoPricing | null): PromoPricingForm {
  if (!promo) {
    return {
      enabled: false,
      title: '',
      offPercent: DEFAULT_OFF_PERCENT,
      models: '',
      expiresAt: '',
    }
  }

  return {
    enabled: promo.enabled,
    title: promo.title,
    offPercent: String(Math.round((1 - promo.discount) * 100)),
    models: promo.models.join(', '),
    expiresAt: promo.expiresAt,
  }
}

function toOptionValue(form: PromoPricingForm): string {
  const offPercent = Number(form.offPercent)
  const discount =
    Number.isFinite(offPercent) && offPercent > 0 && offPercent < 100
      ? (100 - offPercent) / 100
      : DEFAULT_PROMO_DISCOUNT

  const models = form.models
    .split(/[\s,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return JSON.stringify({
    enabled: form.enabled,
    title: form.title.trim(),
    expiresAt: form.expiresAt,
    discount: Number(discount.toFixed(4)),
    models,
  })
}

/**
 * Limited-time campaign editor: the campaign is stored as JSON in the
 * `PromoPricing` option and pushed to every visitor through `/api/status`.
 */
export function PromoPricingSection(props: PromoPricingSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const parsed = useMemo(() => parsePromoPricing(props.data), [props.data])
  const [form, setForm] = useState<PromoPricingForm>(() => toForm(parsed))

  useEffect(() => {
    setForm(toForm(parsePromoPricing(props.data)))
  }, [props.data])

  const update = <K extends keyof PromoPricingForm>(
    key: K,
    value: PromoPricingForm[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    try {
      await updateOption.mutateAsync({
        key: 'PromoPricing',
        value: toOptionValue(form),
      })
      toast.success(t('Setting saved'))
    } catch (error) {
      handleServerError(error, t('Failed to update setting'))
    }
  }

  const offPercent = Number(form.offPercent)
  const discount =
    Number.isFinite(offPercent) && offPercent > 0 && offPercent < 100
      ? (100 - offPercent) / 100
      : DEFAULT_PROMO_DISCOUNT

  return (
    <SettingsSection title={t('Limited-time Pricing')}>
      <div className='space-y-4'>
        <SettingsSwitchField
          checked={form.enabled}
          onCheckedChange={(checked) => update('enabled', checked)}
          label={t('Enable limited-time pricing')}
          description={t(
            'Discount the listed price of the matched models. The original price stays visible with a strikethrough.'
          )}
        />

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='promo-title'>{t('Campaign title')}</Label>
            <Input
              id='promo-title'
              value={form.title}
              placeholder={t('DeepSeek limited-time half price')}
              onChange={(event) => update('title', event.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='promo-off'>{t('Discount (% off)')}</Label>
            <Input
              id='promo-off'
              type='number'
              min={1}
              max={99}
              value={form.offPercent}
              onChange={(event) => update('offPercent', event.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='promo-models'>{t('Models')}</Label>
            <Input
              id='promo-models'
              value={form.models}
              placeholder='deepseek*, deepseek-chat'
              onChange={(event) => update('models', event.target.value)}
            />
            <p className='text-muted-foreground text-xs'>
              {t(
                'Comma separated model names, wildcards supported (deepseek* matches every DeepSeek model).'
              )}
            </p>
          </div>

          <div className='space-y-2'>
            <Label>{t('Ends at')}</Label>
            <DateTimePicker
              value={form.expiresAt ? new Date(form.expiresAt) : undefined}
              onChange={(date) =>
                update('expiresAt', date ? date.toISOString() : '')
              }
              placeholder={t('No deadline')}
            />
            <p className='text-muted-foreground text-xs'>
              {t(
                'Leave empty to keep the campaign running without a deadline.'
              )}
            </p>
          </div>
        </div>

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-muted-foreground text-xs'>
            {t('Pricing page preview:')}{' '}
            <span className='line-through'>$1.00</span>{' '}
            <span className='font-semibold text-red-500'>
              {`$${discount.toFixed(2)}`}
            </span>{' '}
            ·{' '}
            {t('{{percent}}% off', {
              percent: Math.round((1 - discount) * 100),
            })}
          </p>
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
