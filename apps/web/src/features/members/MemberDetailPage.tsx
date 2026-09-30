import { ArrowLeft, Bell, BellOff, CreditCard, MessageSquare, MoreVertical, Pause, Pencil, Play, QrCode, Repeat, UserCheck, UserX, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ageOn,
  ATTENDANCE_METHOD_LABELS,
  formatDate,
  formatPhone,
  GENDER_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type MemberDetail,
  type PaymentDTO,
  type SubscriptionDTO,
} from '@gymflow/shared';
import { useQuickActions } from '../../app/QuickActions';
import { QrCodeCard } from '../../components/QrCodeCard';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DatePicker,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  NotificationStatusBadge,
  PaymentStatusBadge,
  Select,
  SubscriptionBadge,
  Tabs,
  Textarea,
  type Column,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { SendMessageDialog } from '../notifications/SendMessageDialog';
import { CancelPaymentDialog } from '../payments/CancelPaymentDialog';
import { usePlans } from '../plans/hooks';
import { useCreateSubscription, useSubscriptionAction } from '../subscriptions/hooks';
import { useMember, useMemberQr, useRegenerateQr, useUpdateMember } from './hooks';
import { MemberEditDrawer } from './MemberForm';

type Tab = 'overview' | 'payments' | 'subscriptions' | 'notifications' | 'attendance';

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: member, isLoading, error, refetch } = useMember(id);
  const [tab, setTab] = useState<Tab>('overview');

  if (isLoading) return <LoadingState />;
  if (error || !member) return <ErrorState message={error ? errorMessage(error) : 'Membro não encontrado'} onRetry={refetch} />;

  return (
    <>
      <Link to="/members" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Membros
      </Link>
      <MemberHeader member={member} />
      <Tabs
        className="my-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Resumo' },
          { value: 'payments', label: 'Pagamentos', count: member.payments.length },
          { value: 'subscriptions', label: 'Subscrições', count: member.subscriptions.length },
          { value: 'notifications', label: 'Notificações', count: member.notifications.length },
          { value: 'attendance', label: 'Presenças', count: member.attendanceStats.totalVisits },
        ]}
      />
      {tab === 'overview' && <Overview member={member} />}
      {tab === 'payments' && <PaymentsTab payments={member.payments} />}
      {tab === 'subscriptions' && <SubscriptionsTab subscriptions={member.subscriptions} />}
      {tab === 'notifications' && <NotificationsTab member={member} />}
      {tab === 'attendance' && <AttendanceTab member={member} />}
    </>
  );
}

function MemberHeader({ member }: { member: MemberDetail }) {
  const { can } = useAuth();
  const quick = useQuickActions();
  const [qrOpen, setQrOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const sub = member.currentSubscription;

  return (
    <Card>
      <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={member.fullName} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold">{member.fullName}</h1>
              <SubscriptionBadge status={sub?.status ?? null} />
              {!member.active && <Badge tone="gray">Inactivo</Badge>}
              {!member.notificationsEnabled && (
                <Badge tone="gray">
                  <BellOff className="h-3 w-3" /> Sem notificações
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500 tabular">
              {member.code} · {formatPhone(member.phone)}
              {member.email && ` · ${member.email}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('payments:write') && (
            <Button icon={<CreditCard className="h-4 w-4" />} onClick={() => quick.openPayment(member.id)}>
              Registar pagamento
            </Button>
          )}
          <Button variant="outline" icon={<QrCode className="h-4 w-4" />} onClick={() => setQrOpen(true)}>
            QR Code
          </Button>
          {can('members:write') && (
            <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
              Editar
            </Button>
          )}
          <MoreActions member={member} onMessage={() => setMessageOpen(true)} />
        </div>
      </CardBody>
      <QrModal memberId={member.id} open={qrOpen} onClose={() => setQrOpen(false)} />
      {can('members:write') && <MemberEditDrawer open={editOpen} onClose={() => setEditOpen(false)} member={member} />}
      <SendMessageDialog member={member} open={messageOpen} onClose={() => setMessageOpen(false)} />
    </Card>
  );
}

function QrModal({ memberId, open, onClose }: { memberId: string; open: boolean; onClose: () => void }) {
  const { can } = useAuth();
  const qr = useMemberQr(open ? memberId : undefined);
  const regenerate = useRegenerateQr(memberId);
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="QR Code do membro" description="Contém apenas um identificador seguro — nenhum dado pessoal." size="sm">
      <div className="pb-2">
        <QrCodeCard qr={qr.data} onRegenerate={can('members:write') ? () => setConfirm(true) : undefined} regenerating={regenerate.isPending} />
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="primary"
        title="Gerar novo QR Code?"
        description="O QR Code actual deixa de funcionar (útil em caso de perda ou partilha indevida)."
        confirmLabel="Gerar novo"
        loading={regenerate.isPending}
        onConfirm={async () => {
          await regenerate.mutateAsync();
          setConfirm(false);
          toast.success('Novo QR Code gerado');
        }}
      />
    </Modal>
  );
}

function MoreActions({ member, onMessage }: { member: MemberDetail; onMessage: () => void }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<null | 'suspend' | 'cancel' | 'plan'>(null);
  const [reason, setReason] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const update = useUpdateMember(member.id);
  const action = useSubscriptionAction();
  const sub = member.currentSubscription;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setOpen(false);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean; show: boolean }[] = [
    { label: 'Enviar mensagem', icon: <MessageSquare className="h-4 w-4" />, onClick: () => { setOpen(false); onMessage(); }, show: can('notifications:write') || can('members:write') },
    { label: 'Mudar de plano', icon: <Repeat className="h-4 w-4" />, onClick: () => { setOpen(false); setDialog('plan'); }, show: can('subscriptions:write') },
    {
      label: member.notificationsEnabled ? 'Desactivar notificações' : 'Activar notificações',
      icon: member.notificationsEnabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />,
      onClick: () => run(() => update.mutateAsync({ notificationsEnabled: !member.notificationsEnabled }), 'Preferência actualizada'),
      show: can('members:write'),
    },
    {
      label: sub?.remindersPaused ? 'Retomar lembretes' : 'Suspender lembretes',
      icon: sub?.remindersPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />,
      onClick: () => sub && run(() => action.mutateAsync({ id: sub.id, action: 'reminders', paused: !sub.remindersPaused }), 'Lembretes actualizados'),
      show: Boolean(sub && sub.state !== 'CANCELLED') && can('subscriptions:write'),
    },
    {
      label: 'Suspender subscrição',
      icon: <Pause className="h-4 w-4" />,
      onClick: () => { setOpen(false); setReason(''); setDialog('suspend'); },
      show: sub?.state === 'NORMAL' && can('subscriptions:write'),
    },
    {
      label: 'Reactivar subscrição',
      icon: <Play className="h-4 w-4" />,
      onClick: () => sub && run(() => action.mutateAsync({ id: sub.id, action: 'resume' }), 'Subscrição reactivada'),
      show: sub?.state === 'SUSPENDED' && can('subscriptions:write'),
    },
    {
      label: member.active ? 'Marcar como inactivo' : 'Marcar como activo',
      icon: member.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />,
      onClick: () => run(() => update.mutateAsync({ active: !member.active }), 'Estado actualizado'),
      show: can('members:write'),
    },
    {
      label: 'Cancelar subscrição',
      icon: <XCircle className="h-4 w-4" />,
      onClick: () => { setOpen(false); setReason(''); setDialog('cancel'); },
      danger: true,
      show: Boolean(sub && sub.state !== 'CANCELLED') && can('subscriptions:write'),
    },
  ].filter((i) => i.show);

  if (items.length === 0) return null;
  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="icon" onClick={() => setOpen((o) => !o)} aria-label="Mais acções">
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <div className="animate-fade-in absolute right-0 z-30 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {items.map((i) => (
            <button key={i.label} onClick={i.onClick} className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800', i.danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200')}>
              {i.icon} {i.label}
            </button>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={dialog === 'suspend' || dialog === 'cancel'}
        onClose={() => setDialog(null)}
        tone={dialog === 'cancel' ? 'danger' : 'primary'}
        title={dialog === 'cancel' ? 'Cancelar subscrição?' : 'Suspender subscrição?'}
        description={dialog === 'cancel' ? 'Os lembretes param e o membro deixa de ter acesso. O histórico é mantido.' : 'Os lembretes ficam pausados e a entrada é bloqueada até reactivar.'}
        confirmLabel={dialog === 'cancel' ? 'Cancelar subscrição' : 'Suspender'}
        loading={action.isPending}
        onConfirm={() => sub && dialog && dialog !== 'plan' && run(() => action.mutateAsync({ id: sub.id, action: dialog, reason }), dialog === 'cancel' ? 'Subscrição cancelada' : 'Subscrição suspensa').then(() => setDialog(null))}
      >
        <Textarea label="Motivo (opcional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
      <ChangePlanModal member={member} open={dialog === 'plan'} onClose={() => setDialog(null)} />
    </div>
  );
}

function ChangePlanModal({ member, open, onClose }: { member: MemberDetail; open: boolean; onClose: () => void }) {
  const f = useFormat();
  const plans = usePlans();
  const create = useCreateSubscription();
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(f.today);
  useEffect(() => {
    if (open) {
      setPlanId('');
      setStartDate(f.today);
    }
  }, [open, f.today]);
  const submit = async () => {
    try {
      await create.mutateAsync({ memberId: member.id, planId, startDate });
      toast.success('Novo período criado. Registe o pagamento para o activar.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mudar de plano"
      description="Cria um novo período de subscrição (sem pagamento)."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!planId} loading={create.isPending}>Criar período</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Plano"
          placeholder="Seleccione"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          options={(plans.data ?? []).filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.name} — ${p.durationDays} dias — ${f.money(p.priceCents)}` }))}
        />
        <DatePicker label="Início" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{value || <span className="font-normal text-slate-400">—</span>}</dd>
    </div>
  );
}

function Overview({ member }: { member: MemberDetail }) {
  const f = useFormat();
  const sub = member.currentSubscription;
  const s = member.attendanceStats;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader title="Informações pessoais" />
        <CardBody className="py-2">
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <InfoRow label="Telefone" value={formatPhone(member.phone)} />
            <InfoRow label="Email" value={member.email} />
            <InfoRow label="Nascimento" value={member.birthDate && `${formatDate(member.birthDate)} (${ageOn(member.birthDate, f.today)} anos)`} />
            <InfoRow label="Género" value={member.gender && GENDER_LABELS[member.gender]} />
            <InfoRow label="Endereço" value={member.address} />
            <InfoRow label="Emergência" value={member.emergencyContactName && `${member.emergencyContactName}${member.emergencyContactPhone ? ` · ${formatPhone(member.emergencyContactPhone)}` : ''}`} />
            <InfoRow label="Inscrição" value={formatDate(member.joinedAt)} />
          </dl>
          {member.notes && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{member.notes}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Subscrição actual" actions={sub && <SubscriptionBadge status={sub.status} />} />
        <CardBody className="py-2">
          {sub ? (
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label="Plano" value={sub.plan.name} />
              <InfoRow label="Valor" value={f.money(sub.amountCents)} />
              <InfoRow label="Período pago" value={sub.paid ? 'Sim' : sub.amountPaidCents > 0 ? `Parcial (${f.money(sub.amountPaidCents)})` : 'Não'} />
              <InfoRow label="Início" value={formatDate(sub.startDate)} />
              <InfoRow label="Vencimento" value={formatDate(sub.endDate)} />
              <InfoRow
                label="Situação"
                value={
                  sub.daysUntilDue > 0
                    ? `${sub.paid ? 'Vence' : 'Pagamento devido'} em ${sub.daysUntilDue} dia(s)`
                    : sub.daysUntilDue === 0
                      ? 'Vence hoje'
                      : `Em atraso há ${sub.daysOverdue} dia(s)`
                }
              />
              {sub.remindersPaused && <InfoRow label="Lembretes" value="Suspensos" />}
              {sub.stateReason && <InfoRow label="Motivo" value={sub.stateReason} />}
            </dl>
          ) : (
            <EmptyState title="Sem subscrição" description="Registe um pagamento para associar um plano." className="py-8" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Frequência" />
        <CardBody className="grid grid-cols-2 gap-3">
          <Stat label="Total de visitas" value={s.totalVisits} />
          <Stat label="Este mês" value={s.visitsThisMonth} />
          <Stat label="Média semanal" value={s.weeklyAverage.toLocaleString('pt-PT')} />
          <Stat label="Sem treinar" value={s.daysSinceLastVisit === null ? '—' : `${s.daysSinceLastVisit} dias`} highlight={(s.daysSinceLastVisit ?? 0) >= 7} />
          <div className="col-span-2 text-xs text-slate-500">Última visita: {formatDate(s.lastVisit)}</div>
          <div className="col-span-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            Total pago: <strong>{f.money(member.totalPaidCents)}</strong>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <div className={cn('rounded-xl p-3', highlight ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-slate-50 dark:bg-slate-800/60')}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}

function PaymentsTab({ payments }: { payments: PaymentDTO[] }) {
  const f = useFormat();
  const { can } = useAuth();
  const [cancel, setCancel] = useState<PaymentDTO | null>(null);
  const columns: Column<PaymentDTO>[] = [
    { key: 'date', header: 'Data', cell: (p) => <span className="tabular">{formatDate(p.paymentDate)}</span> },
    { key: 'amount', header: 'Valor', align: 'right', cell: (p) => <span className={cn('font-medium', p.status !== 'PAID' && 'text-slate-400 line-through')}>{f.money(p.amountCents)}</span> },
    { key: 'method', header: 'Método', cell: (p) => PAYMENT_METHOD_LABELS[p.method] },
    { key: 'ref', header: 'Referência', hideBelow: 'md', cell: (p) => <span className="tabular">{p.reference ?? '—'}</span> },
    { key: 'period', header: 'Período', hideBelow: 'lg', cell: (p) => (p.periodStart ? `${p.planName} · ${formatDate(p.periodStart)} → ${formatDate(p.periodEnd)}` : '—') },
    { key: 'status', header: 'Estado', cell: (p) => <PaymentStatusBadge status={p.status} /> },
    { key: 'by', header: 'Registado por', hideBelow: 'xl', cell: (p) => <span className="text-xs">{p.receivedBy?.name ?? '—'} · {p.receiptNumber}</span> },
    {
      key: 'x',
      header: <span className="sr-only">Acções</span>,
      align: 'right',
      cell: (p) => p.status === 'PAID' && can('payments:cancel') && <Button size="sm" variant="ghost" onClick={() => setCancel(p)}>Anular</Button>,
    },
  ];
  return (
    <Card>
      <DataTable columns={columns} data={payments} rowKey={(p) => p.id} empty={<EmptyState title="Sem pagamentos" description="Ainda não foram registados pagamentos." />} />
      <CancelPaymentDialog payment={cancel} onClose={() => setCancel(null)} />
    </Card>
  );
}

function SubscriptionsTab({ subscriptions }: { subscriptions: SubscriptionDTO[] }) {
  const f = useFormat();
  const columns: Column<SubscriptionDTO>[] = [
    { key: 'plan', header: 'Plano', cell: (s) => <span className="font-medium">{s.plan.name}</span> },
    { key: 'start', header: 'Início', cell: (s) => <span className="tabular">{formatDate(s.startDate)}</span> },
    { key: 'end', header: 'Término', cell: (s) => <span className="tabular">{formatDate(s.endDate)}</span> },
    { key: 'amount', header: 'Valor', align: 'right', cell: (s) => f.money(s.amountCents) },
    { key: 'paid', header: 'Pago', align: 'right', hideBelow: 'md', cell: (s) => f.money(s.amountPaidCents) },
    { key: 'last', header: 'Último pag.', hideBelow: 'lg', cell: (s) => formatDate(s.lastPaymentDate) },
    { key: 'status', header: 'Estado', cell: (s) => <SubscriptionBadge status={s.status} /> },
  ];
  return (
    <Card>
      <DataTable columns={columns} data={subscriptions} rowKey={(s) => s.id} empty={<EmptyState title="Sem subscrições" />} />
    </Card>
  );
}

function NotificationsTab({ member }: { member: MemberDetail }) {
  const f = useFormat();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      {member.notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="Sem notificações" description="As mensagens enviadas a este membro aparecem aqui." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {member.notifications.map((n) => (
            <li key={n.id} className="px-4 py-3">
              <button className="w-full text-left" onClick={() => setOpen(open === n.id ? null : n.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 tabular">{f.dateTime(n.createdAt)}</span>
                  <Badge tone="blue">{NOTIFICATION_CHANNEL_LABELS[n.channel]}</Badge>
                  <span className="text-sm font-medium">{NOTIFICATION_TYPE_LABELS[n.type]}</span>
                  <span className="ml-auto">
                    <NotificationStatusBadge status={n.status} />
                  </span>
                </div>
                <p className={cn('mt-1 text-sm text-slate-600 dark:text-slate-400', open !== n.id && 'line-clamp-1')}>{n.message}</p>
                {n.error && <p className="mt-1 text-xs text-red-600">{n.error}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AttendanceTab({ member }: { member: MemberDetail }) {
  const f = useFormat();
  return (
    <Card>
      <DataTable
        columns={[
          { key: 'date', header: 'Data', cell: (a) => <span className="tabular">{formatDate(a.date)}</span> },
          { key: 'in', header: 'Entrada', cell: (a) => <span className="tabular">{f.time(a.checkInAt)}</span> },
          { key: 'out', header: 'Saída', cell: (a) => <span className="tabular">{f.time(a.checkOutAt)}</span> },
          { key: 'method', header: 'Método', hideBelow: 'sm', cell: (a) => ATTENDANCE_METHOD_LABELS[a.method] },
          { key: 'flag', header: '', cell: (a) => a.overridden && <Badge tone="orange">Autorizada</Badge> },
        ]}
        data={member.attendance}
        rowKey={(a) => a.id}
        empty={<EmptyState title="Sem presenças" />}
      />
    </Card>
  );
}
