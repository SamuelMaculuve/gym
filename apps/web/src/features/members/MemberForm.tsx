import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  computeEndDate,
  formatDate,
  fromCents,
  GENDER_LABELS,
  GENDERS,
  memberCreateSchema,
  memberUpdateSchema,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type MemberCreateResponse,
  type MemberDTO,
} from '@gymflow/shared';
import { Button, DatePicker, Drawer, Input, Select, Switch, Textarea } from '../../components/ui';
import { cn } from '../../lib/cn';
import { applyServerErrors, errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { usePlans } from '../plans/hooks';
import { useCreateMember, useUpdateMember } from './hooks';

type CreateIn = z.input<typeof memberCreateSchema>;
type CreateOut = z.output<typeof memberCreateSchema>;
type UpdateIn = z.input<typeof memberUpdateSchema>;

/** Campos pessoais partilhados entre criação e edição. */
function PersonalFields() {
  const { register, formState } = useFormContext<CreateIn>();
  const e = formState.errors;
  return (
    <div className="space-y-4">
      <Input label="Nome completo" required autoComplete="off" {...register('fullName')} error={e.fullName?.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Número de celular" required type="tel" inputMode="tel" placeholder="84 123 4567" {...register('phone')} error={e.phone?.message} />
        <Input label="Email" type="email" placeholder="opcional" {...register('email')} error={e.email?.message} />
      </div>
      <details className="group rounded-xl border border-slate-200 dark:border-slate-700">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700 select-none dark:text-slate-300">
          Mais informações <span className="text-xs font-normal text-slate-400">(opcional)</span>
        </summary>
        <div className="space-y-4 border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePicker label="Data de nascimento" {...register('birthDate')} error={e.birthDate?.message} />
            <Select label="Género" placeholder="—" options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))} {...register('gender')} />
          </div>
          <Input label="Endereço" {...register('address')} error={e.address?.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contacto de emergência" placeholder="Nome" {...register('emergencyContactName')} />
            <Input label="Telefone de emergência" type="tel" {...register('emergencyContactPhone')} error={e.emergencyContactPhone?.message} />
          </div>
          <Textarea label="Observações" {...register('notes')} error={e.notes?.message} />
        </div>
      </details>
    </div>
  );
}

export function MemberCreateDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: MemberCreateResponse) => void }) {
  const f = useFormat();
  const plans = usePlans();
  const create = useCreateMember();
  const activePlans = useMemo(() => (plans.data ?? []).filter((p) => p.active), [plans.data]);
  const [customEnd, setCustomEnd] = useState(false);

  const form = useForm<CreateIn, unknown, CreateOut>({
    resolver: zodResolver(memberCreateSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      joinedAt: f.today,
      startDate: f.today,
      planId: '',
      registerPayment: true,
      sendWelcome: true,
      payment: { amount: 0, method: 'CASH', reference: '' },
    },
  });
  const { register, control, setValue, handleSubmit, reset, setError, formState } = form;
  const [planId, startDate, registerPayment, method, sendWelcome] = useWatch({ control, name: ['planId', 'startDate', 'registerPayment', 'payment.method', 'sendWelcome'] });
  const plan = activePlans.find((p) => p.id === planId);
  const computedEnd = plan && startDate ? computeEndDate(startDate, plan.durationDays) : null;

  useEffect(() => {
    if (open) {
      reset();
      setCustomEnd(false);
    }
  }, [open, reset]);

  useEffect(() => {
    if (!planId && activePlans[0]) setValue('planId', activePlans[0].id);
  }, [activePlans, planId, setValue]);

  useEffect(() => {
    if (plan) setValue('payment.amount', fromCents(plan.priceCents));
    if (!customEnd) setValue('endDate', '');
  }, [plan, setValue, customEnd]);

  const submit = handleSubmit(async (values) => {
    try {
      const payload = {
        ...values,
        planId: values.planId || null,
        payment: values.registerPayment && values.planId ? values.payment : null,
        registerPayment: Boolean(values.registerPayment && values.planId),
      };
      const r = await create.mutateAsync(payload);
      toast.success(`Membro ${r.member.code} cadastrado`);
      onCreated(r);
    } catch (e) {
      if (!applyServerErrors(e, setError)) toast.error(errorMessage(e));
    }
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Novo membro"
      description="Dados essenciais, plano e pagamento — em poucos passos."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            {registerPayment && planId ? 'Cadastrar e registar pagamento' : 'Cadastrar membro'}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form onSubmit={submit} className="space-y-6">
          <Section step={1} title="Dados do membro">
            <PersonalFields />
            <DatePicker label="Data de inscrição" {...register('joinedAt')} error={formState.errors.joinedAt?.message} />
          </Section>

          <Section step={2} title="Plano">
            <div className="grid grid-cols-2 gap-2">
              {activePlans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setValue('planId', p.id)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    planId === p.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-900/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
                  )}
                >
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.durationDays} dias · {f.money(p.priceCents)}
                  </p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setValue('planId', '')}
                className={cn('rounded-xl border p-3 text-left text-sm transition', !planId ? 'border-slate-400 bg-slate-50 dark:bg-slate-800' : 'border-dashed border-slate-200 text-slate-500 dark:border-slate-700')}
              >
                Sem plano por agora
              </button>
            </div>
            {plan && (
              <div className="grid gap-4 sm:grid-cols-2">
                <DatePicker label="Início da subscrição" {...register('startDate')} error={formState.errors.startDate?.message} />
                {customEnd ? (
                  <DatePicker label="Término da subscrição" {...register('endDate')} error={formState.errors.endDate?.message} />
                ) : (
                  <div className="space-y-1.5">
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Vencimento</span>
                    <div className="flex h-10 items-center justify-between rounded-lg bg-slate-50 px-3 text-sm dark:bg-slate-800">
                      <span className="font-medium tabular">{formatDate(computedEnd)}</span>
                      <button type="button" className="text-xs text-brand-700 hover:underline dark:text-brand-400" onClick={() => { setCustomEnd(true); setValue('endDate', computedEnd ?? ''); }}>
                        Ajustar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {plan && (
            <Section step={3} title="Pagamento">
              <Switch checked={Boolean(registerPayment)} onChange={(v) => setValue('registerPayment', v)} label="Registar pagamento agora" description="Sem pagamento, a subscrição fica pendente e entra em atraso após a data de início." />
              {registerPayment && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setValue('payment.method', m)}
                        className={cn(
                          'rounded-lg border px-2 py-2 text-xs font-medium transition',
                          method === m ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
                        )}
                      >
                        {PAYMENT_METHOD_LABELS[m]}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Valor" type="number" step="0.01" inputMode="decimal" {...register('payment.amount', { valueAsNumber: true })} error={formState.errors.payment?.amount?.message} />
                    <Input label="Referência" placeholder="Opcional" {...register('payment.reference')} />
                  </div>
                </div>
              )}
            </Section>
          )}

          <Switch checked={Boolean(sendWelcome)} onChange={(v) => setValue('sendWelcome', v)} label="Enviar mensagem de boas-vindas" />
          <button type="submit" className="hidden" />
        </form>
      </FormProvider>
    </Drawer>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white dark:bg-white dark:text-slate-900">{step}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function MemberEditDrawer({ open, onClose, member }: { open: boolean; onClose: () => void; member: MemberDTO }) {
  const update = useUpdateMember(member.id);
  const toForm = (m: MemberDTO): UpdateIn => ({
    fullName: m.fullName,
    phone: m.phone,
    email: m.email ?? '',
    birthDate: m.birthDate ?? '',
    gender: m.gender ?? '',
    address: m.address ?? '',
    emergencyContactName: m.emergencyContactName ?? '',
    emergencyContactPhone: m.emergencyContactPhone ?? '',
    notes: m.notes ?? '',
    joinedAt: m.joinedAt,
  });
  const form = useForm<UpdateIn>({ resolver: zodResolver(memberUpdateSchema), defaultValues: toForm(member) });

  useEffect(() => {
    if (open) form.reset(toForm(member));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success('Dados actualizados');
      onClose();
    } catch (e) {
      if (!applyServerErrors(e, form.setError)) toast.error(errorMessage(e));
    }
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Editar membro"
      description={member.code}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={update.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <FormProvider {...(form as unknown as ReturnType<typeof useForm<CreateIn>>)}>
        <form onSubmit={submit} className="space-y-4">
          <PersonalFields />
          <DatePicker label="Data de inscrição" {...form.register('joinedAt')} error={form.formState.errors.joinedAt?.message} />
          <button type="submit" className="hidden" />
        </form>
      </FormProvider>
    </Drawer>
  );
}
