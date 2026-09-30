import { CreditCard, Receipt } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  addDays,
  formatDate,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  startOfMonth,
  type PaymentDTO,
  type PaymentMethod,
  type PaymentStatus,
} from '@gymflow/shared';
import { useQuickActions } from '../../app/QuickActions';
import { ExportMenu } from '../../components/ExportMenu';
import { PageHeader } from '../../components/PageHeader';
import { Button, Card, DataTable, DatePicker, EmptyState, Pagination, PaymentStatusBadge, SearchInput, Select, StatCard, type Column } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { useFormat } from '../../lib/format';
import { CancelPaymentDialog } from './CancelPaymentDialog';
import { usePayments } from './hooks';

export function PaymentsPage() {
  const f = useFormat();
  const { can } = useAuth();
  const quick = useQuickActions();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [from, setFrom] = useState(startOfMonth(f.today));
  const [to, setTo] = useState(f.today);
  const [page, setPage] = useState(1);
  const [cancel, setCancel] = useState<PaymentDTO | null>(null);

  const query = { q: q || undefined, method: method || undefined, status: status || undefined, from: from || undefined, to: to || undefined, page, pageSize: 20 };
  const { data, isLoading, isFetching } = usePayments(query);
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  const columns: Column<PaymentDTO>[] = [
    { key: 'date', header: 'Data', cell: (p) => <span className="tabular">{formatDate(p.paymentDate)}</span> },
    {
      key: 'member',
      header: 'Membro',
      cell: (p) => (
        <button className="text-left hover:underline" onClick={() => navigate(`/members/${p.memberId}`)} disabled={!can('members:read')}>
          <p className="font-medium text-slate-900 dark:text-white">{p.member?.fullName}</p>
          <p className="text-xs text-slate-500">{p.member?.code}</p>
        </button>
      ),
    },
    { key: 'plan', header: 'Plano', hideBelow: 'lg', cell: (p) => p.planName ?? '—' },
    { key: 'amount', header: 'Valor', align: 'right', cell: (p) => <span className={cn('font-medium', p.status !== 'PAID' && 'text-slate-400 line-through')}>{f.money(p.amountCents)}</span> },
    { key: 'method', header: 'Método', hideBelow: 'sm', cell: (p) => PAYMENT_METHOD_LABELS[p.method] },
    { key: 'ref', header: 'Referência', hideBelow: 'md', cell: (p) => <span className="text-xs tabular">{p.reference ?? '—'}<br /><span className="text-slate-400">{p.receiptNumber}</span></span> },
    { key: 'status', header: 'Estado', cell: (p) => <PaymentStatusBadge status={p.status} /> },
    { key: 'by', header: 'Registado por', hideBelow: 'xl', cell: (p) => p.receivedBy?.name ?? '—' },
    {
      key: 'x',
      header: <span className="sr-only">Acções</span>,
      align: 'right',
      cell: (p) => p.status === 'PAID' && can('payments:cancel') && <Button size="sm" variant="ghost" onClick={() => setCancel(p)}>Anular</Button>,
    },
  ];

  const top = data?.summary.byMethod.slice().sort((a, b) => b.totalCents - a.totalCents)[0];

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Histórico completo. Pagamentos anulados permanecem registados."
        actions={
          <>
            <ExportMenu
              options={async () => {
                const all = await api.payments.list({ ...query, page: 1, pageSize: 200 });
                return {
                  filename: `pagamentos_${from}_${to}`,
                  title: 'Pagamentos',
                  subtitle: `${formatDate(from)} a ${formatDate(to)} · Total ${f.money(all.summary.totalCents)}`,
                  rows: all.items,
                  columns: [
                    { header: 'Recibo', value: (p) => p.receiptNumber },
                    { header: 'Data', value: (p) => formatDate(p.paymentDate) },
                    { header: 'Membro', value: (p) => p.member?.fullName, width: 28 },
                    { header: 'Número', value: (p) => p.member?.code },
                    { header: 'Plano', value: (p) => p.planName },
                    { header: 'Valor (MT)', value: (p) => p.amountCents / 100 },
                    { header: 'Método', value: (p) => PAYMENT_METHOD_LABELS[p.method] },
                    { header: 'Referência', value: (p) => p.reference },
                    { header: 'Estado', value: (p) => PAYMENT_STATUS_LABELS[p.status] },
                    { header: 'Registado por', value: (p) => p.receivedBy?.name },
                  ],
                };
              }}
            />
            {can('payments:write') && (
              <Button icon={<CreditCard className="h-4 w-4" />} onClick={() => quick.openPayment()}>
                Registar pagamento
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total recebido" value={data ? f.money(data.summary.totalCents) : '—'} tone="brand" />
        <StatCard label="Pagamentos válidos" value={data?.summary.count ?? '—'} />
        <StatCard label="Método mais usado" value={top ? PAYMENT_METHOD_LABELS[top.method] : '—'} hint={top && f.money(top.totalCents)} />
        <StatCard label="Ticket médio" value={data && data.summary.count ? f.money(Math.round(data.summary.totalCents / data.summary.count)) : '—'} />
      </div>

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(4,auto)] dark:border-slate-800">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="Membro, telefone, referência ou recibo" />
          <DatePicker aria-label="Desde" value={from} max={to} onChange={(e) => reset(setFrom)(e.target.value)} />
          <DatePicker aria-label="Até" value={to} min={from} onChange={(e) => reset(setTo)(e.target.value)} />
          <Select aria-label="Método" value={method} onChange={(e) => reset(setMethod)(e.target.value as PaymentMethod)} placeholder="Todos os métodos" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
          <Select aria-label="Estado" value={status} onChange={(e) => reset(setStatus)(e.target.value as PaymentStatus)} placeholder="Todos os estados" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))} />
        </div>
        <div className="flex flex-wrap gap-2 px-4 pt-3 text-xs">
          {[
            { label: 'Hoje', from: f.today, to: f.today },
            { label: '7 dias', from: addDays(f.today, -6), to: f.today },
            { label: 'Este mês', from: startOfMonth(f.today), to: f.today },
            { label: '90 dias', from: addDays(f.today, -89), to: f.today },
          ].map((r) => (
            <button
              key={r.label}
              onClick={() => { setFrom(r.from); setTo(r.to); setPage(1); }}
              className={cn('rounded-full px-2.5 py-1 font-medium', from === r.from && to === r.to ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}
            >
              {r.label}
            </button>
          ))}
        </div>
        <DataTable
          columns={columns}
          data={data?.items}
          loading={isLoading || isFetching}
          rowKey={(p) => p.id}
          empty={<EmptyState icon={<Receipt className="h-6 w-6" />} title="Sem pagamentos no período" description="Altere o período ou os filtros." />}
          mobileCard={(p) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.member?.fullName}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]} · {p.receiptNumber}
                </p>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-semibold', p.status !== 'PAID' && 'text-slate-400 line-through')}>{f.money(p.amountCents)}</p>
                {p.status !== 'PAID' && <PaymentStatusBadge status={p.status} />}
              </div>
            </div>
          )}
          footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onChange={setPage} />}
        />
      </Card>
      <CancelPaymentDialog payment={cancel} onClose={() => setCancel(null)} />
    </>
  );
}
