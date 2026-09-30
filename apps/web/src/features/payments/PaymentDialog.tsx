import { zodResolver } from '@hookform/resolvers/zod';
import { Banknote, CheckCircle2, CreditCard, Landmark, MoreHorizontal, Smartphone, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  formatDate,
  fromCents,
  nextPeriodStart,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  paymentCreateSchema,
  type MemberListItem,
  type PaymentCreateResponse,
  type PaymentMethod,
} from '@gymflow/shared';
import { MemberPicker } from '../../components/MemberPicker';
import { Avatar, Button, DatePicker, Input, Modal, Select, SubscriptionBadge, Switch, Textarea } from '../../components/ui';
import { cn } from '../../lib/cn';
import { applyServerErrors, errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useMember } from '../members/hooks';
import { usePlans } from '../plans/hooks';
import { useRegisterPayment } from './hooks';

type FormIn = z.input<typeof paymentCreateSchema>;
type FormOut = z.output<typeof paymentCreateSchema>;

const METHOD_ICONS: Record<PaymentMethod, ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  MPESA: <Smartphone className="h-4 w-4" />,
  EMOLA: <Wallet className="h-4 w-4" />,
  BANK_TRANSFER: <Landmark className="h-4 w-4" />,
  CARD: <CreditCard className="h-4 w-4" />,
  OTHER: <MoreHorizontal className="h-4 w-4" />,
};

interface Props {
  open: boolean;
  onClose: () => void;
  memberId?: string | null;
}

/** Registo rápido de pagamento: pesquisar membro → confirmar valor → registar. */
export function PaymentDialog({ open, onClose, memberId: initialMemberId }: Props) {
  const [picked, setPicked] = useState<MemberListItem | null>(null);
  const [memberId, setMemberId] = useState<string | null>(initialMemberId ?? null);
  const [result, setResult] = useState<PaymentCreateResponse | null>(null);

  useEffect(() => {
    if (open) {
      setMemberId(initialMemberId ?? null);
      setPicked(null);
      setResult(null);
    }
  }, [open, initialMemberId]);

  return (
    <Modal open={open} onClose={onClose} title={result ? 'Pagamento registado' : 'Registar pagamento'} size="md">
      {result ? (
        <PaymentSuccess result={result} onClose={onClose} onAnother={() => { setResult(null); setMemberId(null); setPicked(null); }} />
      ) : memberId ? (
        <PaymentForm memberId={memberId} locked={Boolean(initialMemberId)} onChangeMember={() => { setMemberId(null); setPicked(null); }} onDone={setResult} onCancel={onClose} />
      ) : (
        <div className="space-y-2 pb-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">Pesquise o membro pelo nome, telefone ou número de membro.</p>
          <MemberPicker value={picked} autoFocus onChange={(m) => { setPicked(m); if (m) setMemberId(m.id); }} />
        </div>
      )}
    </Modal>
  );
}

function PaymentForm({ memberId, locked, onChangeMember, onDone, onCancel }: { memberId: string; locked: boolean; onChangeMember: () => void; onDone: (r: PaymentCreateResponse) => void; onCancel: () => void }) {
  const f = useFormat();
  const member = useMember(memberId);
  const plans = usePlans();
  const register = useRegisterPayment();
  const activePlans = useMemo(() => (plans.data ?? []).filter((p) => p.active), [plans.data]);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(paymentCreateSchema),
    defaultValues: { memberId, paymentDate: f.today, method: 'CASH', reference: '', notes: '', sendConfirmation: true, planId: '' },
  });
  const { register: reg, handleSubmit, setValue, control, formState, setError } = form;
  const planId = useWatch({ control, name: 'planId' });
  const method = useWatch({ control, name: 'method' });
  const sendConfirmation = useWatch({ control, name: 'sendConfirmation' });

  const current = member.data?.currentSubscription ?? null;

  // Valores por omissão quando os dados do membro chegam
  useEffect(() => {
    if (!member.data || !plans.data) return;
    const currentPlanActive = current && activePlans.some((p) => p.id === current.plan.id);
    const pid = currentPlanActive ? current!.plan.id : (activePlans[0]?.id ?? '');
    setValue('planId', pid);
    const plan = activePlans.find((p) => p.id === pid);
    const outstanding = current && !current.paid && current.state !== 'CANCELLED' ? current.amountCents - current.amountPaidCents : (plan?.priceCents ?? 0);
    setValue('amount', fromCents(outstanding));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.data?.id, plans.data]);

  const onPlanChange = (id: string) => {
    setValue('planId', id);
    const plan = activePlans.find((p) => p.id === id);
    if (plan) setValue('amount', fromCents(plan.priceCents));
  };

  const renewalHint = useMemo(() => {
    if (!current) return 'Será criado o primeiro período da subscrição.';
    if (!current.paid && current.state !== 'CANCELLED' && (!planId || planId === current.plan.id)) {
      return `Pagamento do período ${formatDate(current.startDate)} → ${formatDate(current.endDate)}.`;
    }
    const start = nextPeriodStart(current.state === 'CANCELLED' ? null : current.endDate, f.today, f.rules);
    return `Renovação: novo período a partir de ${formatDate(start)}.`;
  }, [current, planId, f.today, f.rules]);

  const submit = handleSubmit(async (values) => {
    try {
      const r = await register.mutateAsync({ ...values, planId: values.planId || null });
      toast.success(`Pagamento ${r.payment.receiptNumber} registado`);
      onDone(r);
    } catch (e) {
      if (!applyServerErrors(e, setError)) toast.error(errorMessage(e));
    }
  });

  if (member.isLoading || plans.isLoading) return <div className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  if (!member.data) return <p className="text-sm text-red-600">Membro não encontrado.</p>;

  return (
    <form onSubmit={submit} className="space-y-4 pb-1">
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <Avatar name={member.data.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{member.data.fullName}</p>
          <p className="text-xs text-slate-500">
            {member.data.code}
            {current && ` · ${current.plan.name} · vence ${formatDate(current.endDate)}`}
          </p>
        </div>
        <SubscriptionBadge status={current?.status ?? null} />
        {!locked && (
          <button type="button" onClick={onChangeMember} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
            Alterar
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Plano"
          value={planId ?? ''}
          onChange={(e) => onPlanChange(e.target.value)}
          options={activePlans.map((p) => ({ value: p.id, label: `${p.name} — ${f.money(p.priceCents)}` }))}
          error={formState.errors.planId?.message}
        />
        <Input label="Valor" type="number" step="0.01" min="0" inputMode="decimal" required {...reg('amount', { valueAsNumber: true })} error={formState.errors.amount?.message} />
      </div>
      <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">{renewalHint}</p>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Método de pagamento</span>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setValue('method', m)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition',
                method === m
                  ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20 dark:bg-brand-900/30 dark:text-brand-200'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
              )}
            >
              {METHOD_ICONS[m]}
              {PAYMENT_METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker label="Data do pagamento" max={f.today} {...reg('paymentDate')} error={formState.errors.paymentDate?.message} />
        <Input
          label="Referência"
          placeholder={method === 'MPESA' || method === 'EMOLA' ? 'ID da transacção' : 'Opcional'}
          {...reg('reference')}
          error={formState.errors.reference?.message}
        />
      </div>
      <Textarea label="Observação" rows={2} {...reg('notes')} />
      <Switch checked={Boolean(sendConfirmation)} onChange={(v) => setValue('sendConfirmation', v)} label="Enviar confirmação ao membro" description="WhatsApp e/ou email, conforme as configurações." />

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={register.isPending}>
          Registar pagamento
        </Button>
      </div>
    </form>
  );
}

function PaymentSuccess({ result, onClose, onAnother }: { result: PaymentCreateResponse; onClose: () => void; onAnother: () => void }) {
  const f = useFormat();
  const navigate = useNavigate();
  const { payment, subscription } = result;
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{f.money(payment.amountCents)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {payment.member?.fullName} · {PAYMENT_METHOD_LABELS[payment.method]} · {payment.receiptNumber}
        </p>
      </div>
      <div className="w-full rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
        {subscription.paid ? (
          <p>
            Subscrição <strong>{subscription.plan.name}</strong> válida até <strong>{formatDate(subscription.endDate)}</strong>.
          </p>
        ) : (
          <p>
            Pagamento parcial. Falta <strong>{f.money(subscription.amountCents - subscription.amountPaidCents)}</strong> para concluir o período.
          </p>
        )}
        {result.notificationsQueued > 0 && <p className="mt-1 text-xs text-slate-500">Confirmação enviada ao membro.</p>}
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="flex-1" onClick={() => { onClose(); navigate(`/members/${payment.memberId}`); }}>
          Ver membro
        </Button>
        <Button variant="outline" className="flex-1" onClick={onAnother}>
          Novo pagamento
        </Button>
        <Button className="flex-1" onClick={onClose}>
          Concluir
        </Button>
      </div>
    </div>
  );
}
