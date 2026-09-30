import { BellRing, Repeat } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatDate, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUSES, type SubscriptionDTO, type SubscriptionStatus } from '@gymflow/shared';
import { useQuickActions } from '../../app/QuickActions';
import { ExportMenu } from '../../components/ExportMenu';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Button, Card, DataTable, EmptyState, Pagination, SearchInput, Select, SubscriptionBadge, Tabs, type Column } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useFormat } from '../../lib/format';
import { usePlans } from '../plans/hooks';
import { useSubscriptions } from './hooks';

export function SubscriptionsPage() {
  const f = useFormat();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const plans = usePlans();
  const quick = useQuickActions();
  const { can } = useAuth();
  const canRemind = can('notifications:write') || can('members:write');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const status = (params.get('status') as SubscriptionStatus | null) ?? undefined;
  const planId = params.get('planId') ?? '';
  const query = { q: q || undefined, status, planId: planId || undefined, page, pageSize: 20 };
  const { data, isLoading, isFetching } = useSubscriptions(query);

  const setParam = (k: string, v: string) => {
    setPage(1);
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set(k, v);
      else n.delete(k);
      return n;
    });
  };

  const columns: Column<SubscriptionDTO>[] = [
    {
      key: 'member',
      header: 'Membro',
      cell: (s) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{s.member?.fullName}</p>
          <p className="text-xs text-slate-500">{s.member?.code}</p>
        </div>
      ),
    },
    { key: 'plan', header: 'Plano', cell: (s) => s.plan.name },
    { key: 'start', header: 'Início', hideBelow: 'md', cell: (s) => <span className="tabular">{formatDate(s.startDate)}</span> },
    { key: 'end', header: 'Vencimento', cell: (s) => <span className="tabular">{formatDate(s.endDate)}</span> },
    { key: 'amount', header: 'Valor', align: 'right', hideBelow: 'sm', cell: (s) => f.money(s.amountCents) },
    {
      key: 'status',
      header: 'Estado',
      cell: (s) => (
        <div className="flex items-center gap-1.5">
          <SubscriptionBadge status={s.status} />
          {!s.paid && s.status !== 'CANCELLED' && <Badge tone="orange">Por pagar</Badge>}
          {s.remindersPaused && <Badge tone="gray">Sem lembretes</Badge>}
        </div>
      ),
    },
    { key: 'last', header: 'Último pag.', hideBelow: 'lg', cell: (s) => <span className="tabular">{formatDate(s.lastPaymentDate)}</span> },
    {
      key: 'x',
      header: <span className="sr-only">Acções</span>,
      align: 'right',
      cell: (s) =>
        canRemind &&
        s.status !== 'CANCELLED' && (
          <Button
            size="sm"
            variant="ghost"
            icon={<BellRing className="h-4 w-4" />}
            onClick={(e) => {
              e.stopPropagation();
              quick.openReminder(s.memberId);
            }}
          >
            Lembrar
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Subscrições"
        description="Subscrição actual de cada membro. O estado é calculado automaticamente."
        actions={
          <ExportMenu
            options={async () => {
              const all = await api.subscriptions.list({ ...query, page: 1, pageSize: 200 });
              return {
                filename: 'subscricoes',
                title: 'Subscrições',
                rows: all.items,
                columns: [
                  { header: 'Membro', value: (s) => s.member?.fullName, width: 28 },
                  { header: 'Número', value: (s) => s.member?.code },
                  { header: 'Plano', value: (s) => s.plan.name },
                  { header: 'Início', value: (s) => formatDate(s.startDate) },
                  { header: 'Vencimento', value: (s) => formatDate(s.endDate) },
                  { header: 'Valor (MT)', value: (s) => s.amountCents / 100 },
                  { header: 'Estado', value: (s) => SUBSCRIPTION_STATUS_LABELS[s.status] },
                  { header: 'Último pagamento', value: (s) => formatDate(s.lastPaymentDate) },
                ],
              };
            }}
          />
        }
      />
      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Pesquisar membro" className="flex-1" />
            <Select aria-label="Plano" containerClassName="sm:w-52" value={planId} onChange={(e) => setParam('planId', e.target.value)} placeholder="Todos os planos" options={(plans.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
          </div>
          <Tabs
            value={status ?? 'ALL'}
            onChange={(v) => setParam('status', v === 'ALL' ? '' : v)}
            items={[{ value: 'ALL', label: 'Todas' }, ...SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABELS[s] }))]}
          />
        </div>
        <DataTable
          columns={columns}
          data={data?.items}
          loading={isLoading || isFetching}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/members/${s.memberId}`)}
          empty={<EmptyState icon={<Repeat className="h-6 w-6" />} title="Sem subscrições" description="Nenhuma subscrição corresponde aos filtros." />}
          mobileCard={(s) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.member?.fullName}</p>
                <p className="text-xs text-slate-500">
                  {s.plan.name} · vence {formatDate(s.endDate)} · {f.money(s.amountCents)}
                </p>
              </div>
              <SubscriptionBadge status={s.status} />
            </div>
          )}
          footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onChange={setPage} />}
        />
      </Card>
    </>
  );
}
