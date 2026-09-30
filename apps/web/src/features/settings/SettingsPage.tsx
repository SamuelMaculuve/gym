import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { describeReminderSchedule, gymSettingsSchema, SUPPORTED_CURRENCIES, WEEKDAY_LABELS, WEEKDAYS, type GymSettings, type GymSettingsInput } from '@gymflow/shared';
import { PageHeader } from '../../components/PageHeader';
import { Button, Card, CardBody, CardHeader, controlClass, Input, LoadingState, Select, Switch } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { applyServerErrors, errorMessage } from '../../lib/errors';
import { useSaveSettings, useSettings } from './hooks';

const TIMEZONES = ['Africa/Maputo', 'Africa/Johannesburg', 'Africa/Luanda', 'Africa/Harare', 'Africa/Nairobi', 'Europe/Lisbon', 'Atlantic/Cape_Verde', 'America/Sao_Paulo', 'UTC'];

function toForm(s: GymSettings): GymSettingsInput {
  return {
    name: s.name,
    logoUrl: s.logoUrl ?? '',
    phone: s.phone ?? '',
    email: s.email ?? '',
    address: s.address ?? '',
    whatsapp: s.whatsapp ?? '',
    currency: s.currency,
    timezone: s.timezone,
    openingDays: s.openingDays,
    openingTime: s.openingTime,
    closingTime: s.closingTime,
    memberCodePrefix: s.memberCodePrefix,
    dueSoonDays: s.dueSoonDays,
    expireAfterDays: s.expireAfterDays,
    paymentLinkEnabled: s.paymentLinkEnabled,
    notifications: s.notifications,
  };
}

/** Redimensiona a imagem no browser (máx. 256px) para guardar como logotipo. */
async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 256 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function DayList({ value, onChange, disabled, label, hint }: { value: number[]; onChange: (v: number[]) => void; disabled?: boolean; label: string; hint?: string }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value]);
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        className={cn(controlClass, 'h-10')}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange([...new Set(text.split(/[,;\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 365))])}
        placeholder="ex.: 7, 3, 1"
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function SwitchField({ control, name, label, description, disabled }: { control: Control<GymSettingsInput>; name: `notifications.${'whatsappEnabled' | 'emailEnabled' | 'smsEnabled' | 'sendOnDueDate' | 'sendExpiredNotice' | 'sendWelcome' | 'sendPaymentConfirmation'}` | 'paymentLinkEnabled'; label: string; description?: string; disabled?: boolean }) {
  return <Controller control={control} name={name} render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label={label} description={description} disabled={disabled} />} />;
}

export function SettingsPage() {
  const { can } = useAuth();
  const editable = can('settings:write');
  const { data, isLoading } = useSettings();
  const save = useSaveSettings();
  const form = useForm<GymSettingsInput>({ resolver: zodResolver(gymSettingsSchema) });
  const { register, control, handleSubmit, reset, formState, setValue, setError } = form;
  const logoUrl = useWatch({ control, name: 'logoUrl' });
  const notifications = useWatch({ control, name: 'notifications' });

  useEffect(() => {
    if (data) reset(toForm(data));
  }, [data, reset]);

  if (isLoading || !data) return <LoadingState />;
  const e = formState.errors;

  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success('Configurações guardadas');
    } catch (err) {
      if (!applyServerErrors(err, setError)) toast.error(errorMessage(err));
    }
  });

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Configurações"
        description="Dados do ginásio, regras de subscrição e notificações."
        actions={
          <>
            <Link to="/settings/notifications"><Button variant="outline">Templates de mensagens</Button></Link>
            {editable && <Button type="submit" loading={save.isPending} disabled={!formState.isDirty}>Guardar alterações</Button>}
          </>
        }
      />
      <fieldset disabled={!editable} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ginásio" />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {logoUrl ? <img src={logoUrl} alt="Logotipo" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-slate-400" />}
              </div>
              <div className="flex gap-2">
                <label className={cn('inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700', !editable && 'pointer-events-none opacity-50')}>
                  Carregar logotipo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      if (file) setValue('logoUrl', await resizeImage(file), { shouldDirty: true });
                    }}
                  />
                </label>
                {logoUrl && <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setValue('logoUrl', '', { shouldDirty: true })}>Remover</Button>}
              </div>
            </div>
            {e.logoUrl && <p className="text-xs text-red-600">{e.logoUrl.message}</p>}
            <Input label="Nome do ginásio" {...register('name')} error={e.name?.message} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Telefone" type="tel" {...register('phone')} error={e.phone?.message} />
              <Input label="WhatsApp" type="tel" {...register('whatsapp')} error={e.whatsapp?.message} />
            </div>
            <Input label="Email" type="email" {...register('email')} error={e.email?.message} />
            <Input label="Endereço" {...register('address')} error={e.address?.message} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Moeda" options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c === 'MZN' ? 'Metical (MZN)' : c }))} {...register('currency')} />
              <Select label="Fuso horário" options={TIMEZONES.map((t) => ({ value: t, label: t }))} {...register('timezone')} error={e.timezone?.message} />
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Funcionamento" />
            <CardBody className="space-y-4">
              <Controller
                control={control}
                name="openingDays"
                render={({ field }) => (
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Dias de funcionamento</span>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => {
                        const on = field.value?.includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => field.onChange(on ? field.value.filter((x) => x !== d) : [...(field.value ?? []), d].sort())}
                            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium', on ? 'bg-brand-300 text-slate-950' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}
                          >
                            {WEEKDAY_LABELS[d].slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Abertura" type="time" {...register('openingTime')} error={e.openingTime?.message} />
                <Input label="Fecho" type="time" {...register('closingTime')} error={e.closingTime?.message} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Regras de subscrição" />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Prefixo do nº de membro" {...register('memberCodePrefix')} error={e.memberCodePrefix?.message} hint="ex.: GYM-000001" />
                <Input label="'A vencer' (dias antes)" type="number" {...register('dueSoonDays', { valueAsNumber: true })} error={e.dueSoonDays?.message} />
                <Input label="Expira após (dias de atraso)" type="number" {...register('expireAfterDays', { valueAsNumber: true })} error={e.expireAfterDays?.message} />
              </div>
              <SwitchField control={control} name="paymentLinkEnabled" label='Incluir link "Pagar agora" nos lembretes' description="Página pública com o valor e as formas de pagamento." disabled={!editable} />
            </CardBody>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader title="Notificações e lembretes" description={notifications ? describeReminderSchedule(notifications).join(' · ') : undefined} />
          <CardBody className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Canais</p>
              <SwitchField control={control} name="notifications.whatsappEnabled" label="WhatsApp" disabled={!editable} />
              <SwitchField control={control} name="notifications.emailEnabled" label="Email" disabled={!editable} />
              <SwitchField control={control} name="notifications.smsEnabled" label="SMS" disabled={!editable} />
              <p className="text-xs text-slate-500">
                Fornecedores: {Object.entries(data.providers).map(([c, p]) => `${c} ${p.provider === 'console' ? '(teste)' : p.configured ? '✓' : '✗'}`).join(' · ')}
              </p>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Calendário</p>
              <Controller control={control} name="notifications.daysBefore" render={({ field }) => <DayList label="Dias antes do vencimento" value={field.value ?? []} onChange={field.onChange} disabled={!editable} />} />
              <SwitchField control={control} name="notifications.sendOnDueDate" label="Aviso no dia do vencimento" disabled={!editable} />
              <Controller control={control} name="notifications.overdueDays" render={({ field }) => <DayList label="Dias após o vencimento" value={field.value ?? []} onChange={field.onChange} disabled={!editable} />} />
              <Input label="Depois, repetir a cada (dias)" type="number" hint="0 = não repetir" {...register('notifications.overdueRepeatEveryDays', { valueAsNumber: true })} error={e.notifications?.overdueRepeatEveryDays?.message} />
            </div>
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Outros</p>
              <Input label="Hora de envio automático" type="number" min={0} max={23} hint="Hora local (0–23)" {...register('notifications.sendHour', { valueAsNumber: true })} error={e.notifications?.sendHour?.message} />
              <SwitchField control={control} name="notifications.sendExpiredNotice" label="Aviso de subscrição expirada" disabled={!editable} />
              <SwitchField control={control} name="notifications.sendWelcome" label="Boas-vindas a novos membros" disabled={!editable} />
              <SwitchField control={control} name="notifications.sendPaymentConfirmation" label="Confirmação de pagamento" disabled={!editable} />
            </div>
          </CardBody>
        </Card>
      </fieldset>
    </form>
  );
}
