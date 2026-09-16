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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z
  .object({
    enabled: z.boolean(),
    requireTopUp: z.boolean(),
    dailyDraws: z.coerce
      .number()
      .int()
      .min(1, 'At least one draw per day')
      .max(100, 'At most 100 draws per day'),
    topUpYuanPerDraw: z.coerce
      .number()
      .min(0, 'Cannot be negative')
      .max(100000, 'Too large'),
    referralBaseTickets: z.coerce
      .number()
      .int()
      .min(0, 'Cannot be negative')
      .max(100, 'At most 100 tickets'),
    prizeMinAmount: z.coerce
      .number()
      .min(0.01, 'The lowest prize cannot be under ¥0.01')
      .max(100000, 'Too large'),
    prizeMaxAmount: z.coerce
      .number()
      .min(0.01, 'The highest prize cannot be under ¥0.01')
      .max(100000, 'Too large'),
    prizeExpected: z.coerce
      .number()
      .min(0.01, 'The expected prize cannot be under ¥0.01')
      .max(100000, 'Too large'),
    prizeTiers: z.coerce
      .number()
      .int()
      .min(2, 'At least two tiers')
      .max(30, 'At most 30 tiers'),
  })
  .refine((values) => values.prizeMaxAmount >= values.prizeMinAmount, {
    message: 'The highest prize must be at least the lowest prize',
    path: ['prizeMaxAmount'],
  })

type Values = z.infer<typeof schema>

/** Thousandth precision keeps the expected-value preview readable. */
function formatExpected(amount: number): string {
  if (!Number.isFinite(amount)) return '¥0.00'
  return `¥${amount.toFixed(3)}`
}

export function CheckinSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    /** Only accounts with a successful top-up may check in and draw. */
    requireTopUp: boolean
    dailyDraws: number
    /** Credited CNY that grants one extra draw, `0` turns the bonus off. */
    topUpYuanPerDraw: number
    /** Tickets both sides get when the first top-up stays under the step. */
    referralBaseTickets: number
    /** Lowest prize amount of the pool, in CNY. */
    prizeMinAmount: number
    /** Highest prize amount of the pool, in CNY. */
    prizeMaxAmount: number
    /** Average payout of one draw, in CNY. Tier weights follow from it. */
    prizeExpected: number
    /** Number of prize tiers generated for the board. */
    prizeTiers: number
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      requireTopUp: defaultValues.requireTopUp,
      dailyDraws: defaultValues.dailyDraws,
      topUpYuanPerDraw: defaultValues.topUpYuanPerDraw,
      referralBaseTickets: defaultValues.referralBaseTickets,
      prizeMinAmount: defaultValues.prizeMinAmount,
      prizeMaxAmount: defaultValues.prizeMaxAmount,
      prizeExpected: defaultValues.prizeExpected,
      prizeTiers: defaultValues.prizeTiers,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const dailyDraws = form.watch('dailyDraws')
  const prizeExpected = Number(form.watch('prizeExpected'))
  const draws = Number(dailyDraws)
  const monthly =
    (Number.isFinite(prizeExpected) ? prizeExpected : 0) *
    (Number.isFinite(draws) ? draws : 0) *
    30

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'checkin_setting.enabled',
        value: String(values.enabled),
      })
    }

    if (values.requireTopUp !== defaultValues.requireTopUp) {
      updates.push({
        key: 'checkin_setting.require_topup',
        value: String(values.requireTopUp),
      })
    }

    if (values.dailyDraws !== defaultValues.dailyDraws) {
      updates.push({
        key: 'checkin_setting.daily_draws',
        value: String(values.dailyDraws),
      })
    }

    if (values.topUpYuanPerDraw !== defaultValues.topUpYuanPerDraw) {
      updates.push({
        key: 'checkin_setting.topup_yuan_per_draw',
        value: String(values.topUpYuanPerDraw),
      })
    }

    if (values.referralBaseTickets !== defaultValues.referralBaseTickets) {
      updates.push({
        key: 'checkin_setting.referral_base_tickets',
        value: String(values.referralBaseTickets),
      })
    }

    if (values.prizeMinAmount !== defaultValues.prizeMinAmount) {
      updates.push({
        key: 'checkin_setting.prize_min_amount',
        value: String(values.prizeMinAmount),
      })
    }

    if (values.prizeMaxAmount !== defaultValues.prizeMaxAmount) {
      updates.push({
        key: 'checkin_setting.prize_max_amount',
        value: String(values.prizeMaxAmount),
      })
    }

    if (values.prizeExpected !== defaultValues.prizeExpected) {
      updates.push({
        key: 'checkin_setting.prize_expected_amount',
        value: String(values.prizeExpected),
      })
    }

    if (values.prizeTiers !== defaultValues.prizeTiers) {
      updates.push({
        key: 'checkin_setting.prize_tiers',
        value: String(values.prizeTiers),
      })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    form.reset(values)
  }

  return (
    <SettingsSection title={t('Check-in Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save check-in settings'
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable check-in feature')}</FormLabel>
                  <FormDescription>
                    {t('Allow users to check in daily and win lottery prizes')}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <>
              <FormField
                control={form.control}
                name='requireTopUp'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>
                        {t('Only users with a top-up can join')}
                      </FormLabel>
                      <FormDescription>
                        {t(
                          'When on, only accounts with a successful top-up can check in and draw, which keeps bulk-registered accounts out of the prize pool. Administrators stay exempt so you can still test.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateOption.isPending || isSubmitting}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <FormField
                control={form.control}
                name='dailyDraws'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Draws granted per check-in')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={100}
                        step={1}
                        placeholder='1'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Each check-in hands out this many draw tickets for the prize pool'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='topUpYuanPerDraw'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Top-up amount for one extra draw (CNY)')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step={0.1}
                        inputMode='decimal'
                        placeholder='10'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Every time the credited amount reaches this value the user earns one permanent draw. The credited amount is used, so a discounted top-up counts too. Set 0 to turn the bonus off.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='referralBaseTickets'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Invite tickets for a small first top-up')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={100}
                        step={1}
                        placeholder='1'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'When an invited friend tops up for the first time, the inviter and the friend both earn one draw per step above. If that first top-up stays under one step they still earn this many draws each, so small top-ups keep inviting worthwhile. Set 0 to only reward top-ups that reach the step.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='space-y-4 rounded-lg border p-4'>
                <div className='min-w-0'>
                  <p className='text-sm font-medium'>{t('Prize pool')}</p>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Amounts are in CNY and are credited to the user balance on every draw. The tier amounts and their odds are generated from the range, so the pool never has to be tuned by hand.'
                    )}
                  </p>
                </div>

                <div className='grid gap-4 sm:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='prizeMinAmount'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Lowest prize (CNY)')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0.01}
                            step={0.01}
                            inputMode='decimal'
                            placeholder='0.01'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('The money the most common tier pays out')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='prizeMaxAmount'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Highest prize (CNY)')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0.01}
                            step={0.01}
                            inputMode='decimal'
                            placeholder='1'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('The rare jackpot sitting on top of the pool')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='prizeExpected'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Expected prize per draw (CNY)')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0.01}
                            step={0.01}
                            inputMode='decimal'
                            placeholder='0.1'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'Average payout of one draw. The tier odds are solved from it, staying between the lowest and the highest prize.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='prizeTiers'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Prize tiers')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={2}
                            max={30}
                            step={1}
                            placeholder='12'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'Number of prize tiers on the board, laid out over four columns. Tiers collapse automatically when the range is too narrow to split.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs'>
                  <span>
                    {t('Expected value per draw')}
                    {': '}
                    <span className='text-foreground font-medium tabular-nums'>
                      {formatExpected(prizeExpected)}
                    </span>
                  </span>
                  <span>
                    {t('Expected value over 30 days')}
                    {': '}
                    <span className='text-foreground font-medium tabular-nums'>
                      {formatExpected(monthly)}
                    </span>
                  </span>
                </div>
              </div>
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
