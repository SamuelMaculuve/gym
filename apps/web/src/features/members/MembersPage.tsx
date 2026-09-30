import { BellRing, CreditCard, UserPlus, Users } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  formatDate,
  formatPhone,
  MEMBER_FILTER_LABELS,
  MEMBER_FILTERS,
  SUBSCRIPTION_STATUS_LABELS,
  type MemberFilter,
  type MemberListItem,
  type MemberSort,
} from '@gymflow/shared';
import { useQuickActions } from '../../app/QuickActions';
import { ExportMenu } from '../../components/ExportMenu';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, Button, Card, DataTable, EmptyState, Pagination, SearchInput, Select, SubscriptionBadge, Tabs, type Column } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { usePlans } from '../plans/hooks';
import { useMembers } from './hooks';

export function MembersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const quick = useQuickActions();
  const { can } = useAuth();
  const plans = usePlans();
  const canRemind = can('notifications:write') || can('members:write');

  const query = {
    q: params.get('q') ?? '',
    filter: (params.get('filter') as MemberFilter) || 'all',
    planId: params.get('planId') ?? '',
    sort: (params.get('sort') as MemberSort) || 'name',
    order: (params.get('order') as 'asc' | 'desc') || 'asc',
    page: Number(params.get('page') ?? 1),
    pageSize: 20,
  };
  const { data, isLoading, isFetching } = useMembers({ ...query, planId: query.planId || undefined, q: query.q || undefined });

  const update = useCallback(
    (patch: Record<string, string | number | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '' || (k === 'filter' && v === 'all') || (k === 'page' && v === 1)) next.delete(k);
            else next.set(k, String(v));
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const onSort = (key: string) => update({ sort: key, order: query.sort === key && query.order === 'asc' ? 'desc' : 'asc' });

  const columns: Column<MemberListItem>[] = [
    {
      key: 'name',
      header: 'Nome',
      sortKey: 'name',
      cell: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.fullName} size="sm" />
          <div className="min-w-0">
            <p className={cn('truncate font-medium text-slate-900 dark:text-white', !m.active && 'text-slate-400 line-through')}>{m.fullName}</p>
            <p className="text-xs text-slate-500 tabular">{m.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Telefone', cell: (m) => <span className="whitespace-nowrap tabular">{formatPhone(m.phone)}</span> },
    { key: 'email', header: 'Email', hideBelow: '2xl', cell: (m) => m.email ?? <span className="text-slate-400">—</span> },
    { key: 'plan', header: 'Plano', hideBelow: 'lg', cell: (m) => m.planName ?? <span className="text-slate-400">—</span> },
    { key: 'joined', header: 'Inscrição', sortKey: 'joinedAt', hideBelow: '2xl', cell: (m) => <span className="tabular">{formatDate(m.joinedAt)}</span> },
    { key: 'due', header: 'Vencimento', sortKey: 'dueDate', cell: (m) => <span className="tabular">{formatDate(m.endDate)}</span> },
    { key: 'status', header: 'Estado', sortKey: 'status', cell: (m) => <SubscriptionBadge status={m.status} /> },
    { key: 'last', header: 'Último pag.', sortKey: 'lastPayment', hideBelow: 'lg', cell: (m) => <span className="tabular">{formatDate(m.lastPaymentDate)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Acções</span>,
      align: 'right',
      cell: (m) => (
        <div className="flex justify-end gap-1">
          {canRemind && m.subscriptionId && m.status !== 'CANCELLED' && (
            <Button
              size="sm"
              variant="ghost"
              icon={<BellRing className="h-4 w-4" />}
              aria-label={`Enviar lembrete a ${m.fullName}`}
              title="Enviar lembrete"
              disabled={!m.notificationsEnabled}
              onClick={(e) => {
                e.stopPropagation();
                quick.openReminder(m.id);
              }}
            />
          )}
          {can('payments:write') && (
            <Button
              size="sm"
              variant="ghost"
              icon={<CreditCard className="h-4 w-4" />}
              onClick={(e) => {
                e.stopPropagation();
                quick.openPayment(m.id);
              }}
            >
              Pagar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Membros"
        description={data ? `${data.total} ${data.total === 1 ? 'membro' : 'membros'}` : undefined}
        actions={
          <>
            <ExportMenu
              options={async () => {
                const all = await api.members.list({ ...query, planId: query.planId || undefined, q: query.q || undefined, page: 1, pageSize: 200 });
                return {
                  filename: 'membros',
                  title: 'Membros',
                  subtitle: MEMBER_FILTER_LABELS[query.filter],
                  rows: all.items,
                  columns: [
                    { header: 'Número', value: (m) => m.code },
                    { header: 'Nome', value: (m) => m.fullName, width: 28 },
                    { header: 'Telefone', value: (m) => formatPhone(m.phone), width: 18 },
                    { header: 'Email', value: (m) => m.email, width: 28 },
                    { header: 'Plano', value: (m) => m.planName },
                    { header: 'Inscrição', value: (m) => formatDate(m.joinedAt) },
                    { header: 'Vencimento', value: (m) => formatDate(m.endDate) },
                    { header: 'Estado', value: (m) => (m.status ? SUBSCRIPTION_STATUS_LABELS[m.status] : 'Sem plano') },
                    { header: 'Último pagamento', value: (m) => formatDate(m.lastPaymentDate) },
                  ],
                };
              }}
            />
            {can('members:write') && (
              <Button icon={<UserPlus className="h-4 w-4" />} onClick={quick.openNewMember}>
                Novo membro
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchInput value={query.q} onChange={(q) => update({ q })} placeholder="Nome, telefone, email ou número" className="flex-1" />
            <Select
              aria-label="Filtrar por plano"
              containerClassName="sm:w-52"
              value={query.planId}
              onChange={(e) => update({ planId: e.target.value })}
              placeholder="Todos os planos"
              options={(plans.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <Tabs value={query.filter} onChange={(filter) => update({ filter })} items={MEMBER_FILTERS.map((f) => ({ value: f, label: MEMBER_FILTER_LABELS[f] }))} />
        </div>

        <DataTable
          columns={columns}
          data={data?.items}
          loading={isLoading || isFetching}
          rowKey={(m) => m.id}
          onRowClick={(m) => navigate(`/members/${m.id}`)}
          sort={{ key: query.sort, order: query.order }}
          onSortChange={onSort}
          empty={
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Nenhum membro encontrado"
              description={query.q || query.filter !== 'all' ? 'Ajuste a pesquisa ou os filtros.' : 'Comece por cadastrar o primeiro membro.'}
              action={can('members:write') && !query.q && <Button onClick={quick.openNewMember}>Novo membro</Button>}
            />
          }
          mobileCard={(m) => (
            <div className="flex items-center gap-3">
              <Avatar name={m.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.fullName}</p>
                <p className="text-xs text-slate-500">
                  {m.code} · {m.planName ?? 'Sem plano'} · vence {formatDate(m.endDate)}
                </p>
              </div>
              <SubscriptionBadge status={m.status} />
            </div>
          )}
          footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onChange={(page) => update({ page })} />}
        />
      </Card>
    </>
  );
}
