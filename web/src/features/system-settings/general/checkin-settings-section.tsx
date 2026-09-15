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
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
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

const schema = z.object({
  enabled: z.boolean(),
  dailyDraws: z.coerce
    .number()
    .int()
    .min(1, 'At least one draw per day')
    .max(100, 'At most 100 draws per day'),
  topUpYuanPerDraw: z.coerce
    .number()
    .min(0, 'Cannot be negative')
    .max(100000, 'Too large'),
})

type Values = z.infer<typeof schema>

/** One editable prize tier. Amounts are entered in CNY yuan. */
export interface CheckinPrizeOption {
  amount: number
  weight: number
}

/**
 * Default prize pool. The single-draw expectation is ¥0.102, so one draw a
 * day over 30 days pays out about ¥3.06.
 */
export const DEFAULT_CHECKIN_PRIZES: CheckinPrizeOption[] = [
  { amount: 0.05, weight: 40 },
  { amount: 0.08, weight: 25 },
  { amount: 0.1, weight: 15 },
  { amount: 0.15, weight: 10 },
  { amount: 0.2, weight: 6 },
  { amount: 0.5, weight: 4 },
]

type PrizeRow = {
  id: string
  /** Kept as strings so partial input such as `0.` stays editable. */
  amount: string
  weight: string
}

let prizeRowSeed = 0

function toRows(prizes: CheckinPrizeOption[]): PrizeRow[] {
  return prizes.map((prize) => {
    prizeRowSeed += 1
    return {
      id: `prize-${prizeRowSeed}`,
      amount: String(prize.amount),
      weight: String(prize.weight),
    }
  })
}

function defaultNewRow(): PrizeRow {
  prizeRowSeed += 1
  return { id: `prize-${prizeRowSeed}`, amount: '', weight: '' }
}

/** Serialise tiers into the compact JSON string the option store expects. */
function serializePrizes(prizes: CheckinPrizeOption[]): string {
  return JSON.stringify(
    prizes.map((prize) => ({
      amount: prize.amount,
      weight: prize.weight,
    }))
  )
}

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
    dailyDraws: number
    /** Credited CNY that grants one extra draw, `0` turns the bonus off. */
    topUpYuanPerDraw: number
    prizes: CheckinPrizeOption[]
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [rows, setRows] = useState<PrizeRow[]>(() =>
    toRows(defaultValues.prizes)
  )

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      dailyDraws: defaultValues.dailyDraws,
      topUpYuanPerDraw: defaultValues.topUpYuanPerDraw,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const dailyDraws = form.watch('dailyDraws')

  const preview = useMemo(() => {
    const parsed = rows.map((row) => ({
      amount: Number(row.amount),
      weight: Number(row.weight),
    }))
    const valid = parsed.filter(
      (prize) =>
        Number.isFinite(prize.amount) &&
        prize.amount > 0 &&
        Number.isInteger(prize.weight) &&
        prize.weight > 0
    )
    const totalWeight = valid.reduce((sum, prize) => sum + prize.weight, 0)
    const expected =
      totalWeight > 0
        ? valid.reduce((sum, prize) => sum + prize.amount * prize.weight, 0) /
          totalWeight
        : 0
    const draws = Number(dailyDraws)
    const monthly = expected * (Number.isFinite(draws) ? draws : 0) * 30
    return { totalWeight, expected, monthly }
  }, [dailyDraws, rows])

  const prizesDirty = useMemo(() => {
    try {
      return (
        serializePrizes(
          rows.map((row) => ({
            amount: Number(row.amount),
            weight: Number(row.weight),
          }))
        ) !== serializePrizes(defaultValues.prizes)
      )
    } catch {
      return true
    }
  }, [defaultValues.prizes, rows])

  const formDirty = isDirty || prizesDirty

  function updateRow(id: string, patch: Partial<Omit<PrizeRow, 'id'>>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id))
  }

  function addRow() {
    setRows((current) => [...current, defaultNewRow()])
  }

  function collectPrizes(): CheckinPrizeOption[] | null {
    if (rows.length === 0) {
      toast.error(t('Add at least one prize tier'))
      return null
    }

    const prizes: CheckinPrizeOption[] = []
    for (const row of rows) {
      const amount = Number(row.amount)
      const weight = Number(row.weight)
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error(t('Every prize amount must be greater than 0'))
        return null
      }
      if (!Number.isInteger(weight) || weight <= 0) {
        toast.error(t('Every prize weight must be a positive integer'))
        return null
      }
      prizes.push({ amount, weight })
    }
    return prizes
  }

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'checkin_setting.enabled',
        value: String(values.enabled),
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

    if (prizesDirty) {
      const prizes = collectPrizes()
      if (!prizes) return
      updates.push({
        key: 'checkin_setting.prizes',
        value: serializePrizes(prizes),
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
            isSaveDisabled={!formDirty}
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

              <div className='rounded-lg border p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>{t('Prize pool')}</p>
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Amounts are in CNY and are credited to the user balance on every draw'
                      )}
                    </p>
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={addRow}
                    disabled={updateOption.isPending || isSubmitting}
                  >
                    <Plus className='size-4' />
                    {t('Add tier')}
                  </Button>
                </div>

                <div className='mt-3 space-y-2'>
                  <div className='text-muted-foreground hidden gap-3 px-1 text-xs sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_2.25rem]'>
                    <span>{t('Amount (CNY)')}</span>
                    <span>{t('Weight')}</span>
                    <span className='text-right'>{t('Chance')}</span>
                    <span />
                  </div>

                  {rows.length === 0 ? (
                    <p className='text-muted-foreground py-2 text-xs'>
                      {t('No prize tiers configured yet')}
                    </p>
                  ) : null}

                  {rows.map((row) => {
                    const amount = Number(row.amount)
                    const weight = Number(row.weight)
                    const chance =
                      preview.totalWeight > 0 &&
                      Number.isFinite(weight) &&
                      weight > 0
                        ? `${((weight / preview.totalWeight) * 100).toFixed(2)}%`
                        : '-'
                    return (
                      <div
                        key={row.id}
                        className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_2.25rem] sm:items-center sm:gap-3'
                      >
                        <Input
                          type='number'
                          min={0.01}
                          step={0.01}
                          inputMode='decimal'
                          value={row.amount}
                          placeholder='0.05'
                          aria-label={t('Amount (CNY)')}
                          onChange={(event) =>
                            updateRow(row.id, { amount: event.target.value })
                          }
                          disabled={updateOption.isPending || isSubmitting}
                        />
                        <Input
                          type='number'
                          min={1}
                          step={1}
                          inputMode='numeric'
                          value={row.weight}
                          placeholder='40'
                          aria-label={t('Weight')}
                          onChange={(event) =>
                            updateRow(row.id, { weight: event.target.value })
                          }
                          disabled={updateOption.isPending || isSubmitting}
                        />
                        <span className='text-muted-foreground text-xs tabular-nums sm:text-right'>
                          {chance}
                        </span>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='text-muted-foreground hover:text-destructive justify-self-end'
                          aria-label={t('Remove tier')}
                          onClick={() => removeRow(row.id)}
                          disabled={updateOption.isPending || isSubmitting}
                        >
                          <Trash2 className='size-4' />
                        </Button>
                        {Number.isFinite(amount) && amount > 0 ? null : (
                          <span className='text-destructive text-xs sm:col-span-4'>
                            {t('Enter a prize amount greater than 0')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className='text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs'>
                  <span>
                    {t('Total weight')}
                    {': '}
                    <span className='text-foreground font-medium tabular-nums'>
                      {preview.totalWeight}
                    </span>
                  </span>
                  <span>
                    {t('Expected value per draw')}
                    {': '}
                    <span className='text-foreground font-medium tabular-nums'>
                      {formatExpected(preview.expected)}
                    </span>
                  </span>
                  <span>
                    {t('Expected value over 30 days')}
                    {': '}
                    <span className='text-foreground font-medium tabular-nums'>
                      {formatExpected(preview.monthly)}
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
