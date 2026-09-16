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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, type ChangeEvent } from 'react'
import type { Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Switch } from '@/components/ui/switch'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import {
  formatNumber,
  formatQuota,
  getEditableQuotaStep,
  parseQuotaFromDollars,
  quotaUnitsToEditableAmount,
} from '@/lib/format'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
  SettingsFormGrid,
  SettingsFormGridItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const quotaSchema = z.object({
  QuotaForNewUser: z.coerce.number().min(0),
  PreConsumedQuota: z.coerce.number().min(0),
  QuotaForInviter: z.coerce.number().min(0),
  QuotaForInvitee: z.coerce.number().min(0),
  TopUpLink: z.string(),
  general_setting: z.object({
    docs_link: z.string(),
  }),
  quota_setting: z.object({
    enable_free_model_pre_consume: z.boolean(),
  }),
})

type QuotaFormValues = z.infer<typeof quotaSchema>
type QuotaInputValue = number | ''

/**
 * Quota amounts are stored in raw quota units, but operators configure them in
 * the site balance unit (e.g. CNY). These fields are the ones that hold a quota
 * amount, so the form converts them in both directions.
 */
const QUOTA_AMOUNT_KEYS = [
  'QuotaForNewUser',
  'PreConsumedQuota',
  'QuotaForInviter',
  'QuotaForInvitee',
] as const

type QuotaAmountKey = (typeof QUOTA_AMOUNT_KEYS)[number]

const QUOTA_AMOUNT_KEY_SET: ReadonlySet<string> = new Set(QUOTA_AMOUNT_KEYS)

function toEditableAmount(quota: number | undefined): number {
  if (typeof quota !== 'number' || !Number.isFinite(quota)) {
    return 0
  }

  return quotaUnitsToEditableAmount(quota)
}

type QuotaSettingsSectionProps = {
  defaultValues: QuotaFormValues
  complianceConfirmed?: boolean
}

export function QuotaSettingsSection({
  defaultValues,
  complianceConfirmed = true,
}: QuotaSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const { config, meta } = getCurrencyDisplay()
  const tokensOnly = meta.kind === 'tokens'
  const currencyLabel = getCurrencyLabel()
  const amountStep = getEditableQuotaStep()
  const handleNumberChange =
    (onChange: (value: QuotaInputValue) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.valueAsNumber
      onChange(Number.isNaN(value) ? '' : value)
    }

  // Defaults arrive as raw quota units; the form works with balance amounts.
  const formDefaults = useMemo<QuotaFormValues>(
    () => ({
      ...defaultValues,
      QuotaForNewUser: toEditableAmount(defaultValues.QuotaForNewUser),
      PreConsumedQuota: toEditableAmount(defaultValues.PreConsumedQuota),
      QuotaForInviter: toEditableAmount(defaultValues.QuotaForInviter),
      QuotaForInvitee: toEditableAmount(defaultValues.QuotaForInvitee),
    }),
    [defaultValues]
  )

  const { form, handleSubmit, isDirty, isSubmitting } =
    useSettingsForm<QuotaFormValues>({
      resolver: zodResolver(quotaSchema) as Resolver<
        QuotaFormValues,
        unknown,
        QuotaFormValues
      >,
      defaultValues: formDefaults,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          const amount = typeof value === 'number' ? value : Number(value) || 0
          await updateOption.mutateAsync({
            key,
            value: QUOTA_AMOUNT_KEY_SET.has(key)
              ? parseQuotaFromDollars(amount)
              : (value as string | number | boolean),
          })
        }
      },
    })

  const renderQuotaAmountField = (
    name: QuotaAmountKey,
    label: string,
    description: (formattedAmount: string) => string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const amount =
          typeof field.value === 'number'
            ? field.value
            : Number(field.value) || 0
        const inputProps = {
          type: 'number',
          value: field.value ?? '',
          onChange: handleNumberChange(field.onChange),
          name: field.name,
          onBlur: field.onBlur,
          ref: field.ref,
        }

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            {tokensOnly ? (
              <FormControl>
                <Input {...inputProps} />
              </FormControl>
            ) : (
              // InputGroup wraps the field in a plain div, so the form control
              // props (id, aria-describedby) have to sit on the input itself
              // or the label would stop pointing at the editable control.
              <InputGroup>
                <InputGroupAddon>{meta.symbol}</InputGroupAddon>
                <FormControl>
                  <InputGroupInput {...inputProps} step={amountStep} min={0} />
                </FormControl>
                <InputGroupAddon align='inline-end'>
                  {currencyLabel}
                </InputGroupAddon>
              </InputGroup>
            )}
            <FormDescription>
              {description(formatQuota(parseQuotaFromDollars(amount)))}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )

  return (
    <SettingsSection title={t('Quota Settings')}>
      <FormNavigationGuard when={isDirty} />

      {!complianceConfirmed ? (
        <Alert variant='destructive'>
          <AlertDescription>
            {t(
              'Non-zero invitation rewards require compliance confirmation in Payment Gateway settings.'
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <SettingsForm onSubmit={handleSubmit}>
          <SettingsPageFormActions
            onSave={handleSubmit}
            isSaving={updateOption.isPending || isSubmitting}
          />
          <FormDirtyIndicator isDirty={isDirty} />
          <SettingsFormGrid>
            <SettingsFormGridItem span='full'>
              <p className='text-muted-foreground text-sm'>
                {tokensOnly
                  ? t(
                      'Currency display is disabled, so quota values below are entered as raw quota units.'
                    )
                  : t(
                      'Quota values below are entered in {{currency}}. 1 {{currency}} = {{quota}} quota units.',
                      {
                        currency: meta.symbol,
                        quota: formatNumber(config.quotaPerUnit),
                      }
                    )}
              </p>
            </SettingsFormGridItem>

            {renderQuotaAmountField(
              'QuotaForNewUser',
              t('New User Quota'),
              (formattedAmount) =>
                t('Initial quota given to new users ({{formattedQuota}})', {
                  formattedQuota: formattedAmount,
                })
            )}

            {renderQuotaAmountField(
              'PreConsumedQuota',
              t('Pre-Consumed Quota'),
              (formattedAmount) =>
                t('Quota pre-charged before settlement ({{formattedQuota}})', {
                  formattedQuota: formattedAmount,
                })
            )}

            {renderQuotaAmountField(
              'QuotaForInviter',
              t('Inviter Reward'),
              (formattedAmount) =>
                t(
                  'Quota given to users who invite others ({{formattedQuota}})',
                  { formattedQuota: formattedAmount }
                )
            )}

            {renderQuotaAmountField(
              'QuotaForInvitee',
              t('Invitee Reward'),
              (formattedAmount) =>
                t('Quota given to invited users ({{formattedQuota}})', {
                  formattedQuota: formattedAmount,
                })
            )}

            <SettingsFormGridItem span='full'>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Invite rewards are paid as draw tickets. Configure them in Check-in Rewards.'
                )}
              </p>
            </SettingsFormGridItem>

            <SettingsFormGridItem span='full'>
              <FormField
                control={form.control}
                name='quota_setting.enable_free_model_pre_consume'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Pre-Consume for Free Models')}</FormLabel>
                      <FormDescription>
                        {t(
                          'When enabled, zero-cost models also pre-consume quota before final settlement.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateOption.isPending}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />
            </SettingsFormGridItem>

            <FormField
              control={form.control}
              name='TopUpLink'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Top-Up Link')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://example.com/topup')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('External link for users to purchase quota')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='general_setting.docs_link'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Documentation Link')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://docs.example.com')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Link to your documentation site')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsFormGrid>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
