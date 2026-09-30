import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Banknote, CalendarCheck, CalendarClock, CircleDollarSign, Clock, Receipt, TrendingDown, TrendingUp, UserCheck, UserPlus, Users, UserX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate, PAYMENT_METHOD_LABELS } from '@gymflow/shared';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton, StatCard } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { qk } from '../../lib/query-keys';
import { RevenueChart } from './RevenueChart';
import { PaymentStatusCard, StatusBreakdown } from './StatusBreakdown';

export function DashboardPage() {
  const f = useFormat();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: qk.dashboard, queryFn: api.dashboard.summary, refetchInterval: 120_000 });

  if (error) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const t = data?.totals;
  const delta = t && t.revenuePrevMonthCents > 0 ? Math.round(((t.revenueThisMonthCents - t.revenuePrevMonthCents) / t.revenuePrevMonthCents) * 100) : null;
  const canMembers = can('members:read');
  const go = (filter: string) => (canMembers ? () => navigate(`/members?filter=${filter}`) : undefined);

  return (
    <>
      <PageHeader title={`Olá, ${user?.name.split(' ')[0] ?? ''}`} description={`Resumo de hoje, ${formatDate(f.today)}.`} />

      {/* Alertas */}
      {t && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Alert tone="red" emoji="🔴" label={`${t.overdue} pagamentos atrasados`} onClick={go('overdue')} />
          <Alert tone="amber" emoji="🟠" label={`${t.dueToday + t.dueNext7Days} subscrições a vencer`} onClick={go('due_7_days')} />
          <Alert tone="green" emoji="🟢" label={`${t.paymentsThisMonth} pagamentos recebidos este mês`} onClick={can('payments:read') ? () => navigate('/payments') : undefined} />
          <Alert tone="blue" emoji="🔵" label={`${t.newMembersThisMonth} novos membros`} onClick={canMembers ? () => navigate('/members?sort=joinedAt&order=desc') : undefined} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {isLoading || !t ? (
          Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Total de membros" value={t.members} icon={<Users className="h-4 w-4" />} onClick={go('all')} />
            <StatCard label="Membros activos" value={t.activeMembers} icon={<UserCheck className="h-4 w-4" />} tone="brand" onClick={go('active')} />
            <StatCard label="Membros inactivos" value={t.inactiveMembers} icon={<UserX className="h-4 w-4" />} onClick={go('inactive')} />
            <StatCard label="Vencem hoje" value={t.dueToday} icon={<CalendarClock className="h-4 w-4" />} tone="amber" onClick={go('due_today')} />
            <StatCard label="Vencem em 7 dias" value={t.dueNext7Days} icon={<Clock className="h-4 w-4" />} tone="amber" onClick={go('due_7_days')} />
            <StatCard label="Pagamentos em atraso" value={t.overdue} icon={<AlertTriangle className="h-4 w-4" />} tone="red" onClick={go('overdue')} />
            <StatCard
              label="Receita deste mês"
              value={f.money(t.revenueThisMonthCents)}
              icon={<CircleDollarSign className="h-4 w-4" />}
              tone="brand"
              hint={
                delta !== null && (
                  <span className={cn('inline-flex items-center gap-1', delta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {delta > 0 ? '+' : ''}
                    {delta}% vs mês anterior
                  </span>
                )
              }
            />
            <StatCard label="Receita do mês anterior" value={f.money(t.revenuePrevMonthCents)} icon={<Banknote className="h-4 w-4" />} />
            <StatCard label="Pagamentos este mês" value={t.paymentsThisMonth} icon={<Receipt className="h-4 w-4" />} tone="blue" />
            <StatCard label="Novos membros este mês" value={t.newMembersThisMonth} icon={<UserPlus className="h-4 w-4" />} tone="blue" />
          </>
        )}
      </div>

      {data && (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevenueChart data={data.revenueByMonth} />
            </div>
            <ActionsCard
              items={[
                { count: t!.overdue, text: (n) => `${n} ${n === 1 ? 'membro tem pagamento' : 'membros têm pagamentos'} em atraso.`, tone: 'red', filter: 'overdue' },
                { count: t!.dueToday, text: (n) => `${n} ${n === 1 ? 'membro vence' : 'membros vencem'} hoje.`, tone: 'amber', filter: 'due_today' },
                { count: t!.dueNext7Days, text: (n) => `${n} ${n === 1 ? 'membro vence' : 'membros vencem'} nos próximos 7 dias.`, tone: 'amber', filter: 'due_7_days' },
                { count: data.inactiveAttendees.length, text: (n) => `${n} membros activos não treinam há 7+ dias.`, tone: 'blue', anchor: '#frequencia' },
              ]}
              canView={canMembers}
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatusBreakdown data={data.subscriptionStatus} />
            <PaymentStatusCard data={data.paymentStatus} />
            <Card>
              <CardHeader title="Presenças" description="Hoje e esta semana" actions={can('attendance:read') && <Link to="/attendance" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">Ver todas</Link>} />
              <CardBody className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500">Hoje</p>
                  <p className="mt-1 text-2xl font-semibold">{t!.attendanceToday}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500">Esta semana</p>
                  <p className="mt-1 text-2xl font-semibold">{t!.attendanceThisWeek}</p>
                </div>
                <div className="col-span-2">
                  <p className="mb-2 text-xs font-medium text-slate-500">Mais frequentes (30 dias)</p>
                  <MemberList items={data.topAttendees.map((m) => ({ ...m, right: `${m.visits} visitas` }))} empty="Sem presenças recentes." />
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2" id="frequencia">
            <Card>
              <CardHeader title="Não frequentam há 7+ dias" description="Membros activos para contactar" />
              <CardBody>
                <MemberList
                  items={data.inactiveAttendees.map((m) => ({ ...m, right: m.days === null ? 'Nunca visitou' : `${m.days} dias` }))}
                  empty="Todos os membros activos treinaram esta semana. 💪"
                />
              </CardBody>
            </Card>
            {can('payments:read') && (
              <Card>
                <CardHeader title="Últimos pagamentos" actions={<Link to="/payments" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">Ver todos</Link>} />
                <CardBody className="p-0">
                  {data.recentPayments.length === 0 ? (
                    <EmptyState title="Sem pagamentos" />
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.recentPayments.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                          <Avatar name={p.member?.fullName ?? '?'} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.member?.fullName}</p>
                            <p className="text-xs text-slate-500">
                              {formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]}
                            </p>
                          </div>
                          <span className={cn('text-sm font-semibold tabular', p.status !== 'PAID' && 'text-slate-400 line-through')}>{f.money(p.amountCents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Alert({ tone, emoji, label, onClick }: { tone: 'red' | 'amber' | 'green' | 'blue'; emoji: string; label: string; onClick?: () => void }) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
    blue: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200',
  };
  return (
    <button onClick={onClick} disabled={!onClick} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition enabled:hover:shadow-sm', tones[tone])}>
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  );
}

function ActionsCard({ items, canView }: { items: { count: number; text: (n: number) => string; tone: 'red' | 'amber' | 'blue'; filter?: string; anchor?: string }[]; canView: boolean }) {
  const navigate = useNavigate();
  const visible = items.filter((i) => i.count > 0);
  const dot = { red: 'bg-red-500', amber: 'bg-amber-500', blue: 'bg-blue-500' };
  return (
    <Card>
      <CardHeader title="Acções necessárias" description="O que precisa de atenção hoje" />
      <CardBody className="space-y-2">
        {visible.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Tudo em dia" description="Não há acções pendentes." className="py-8" />
        ) : (
          visible.map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', dot[item.tone])} />
              <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item.text(item.count)}</p>
              {canView && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => (item.filter ? navigate(`/members?filter=${item.filter}`) : document.querySelector(item.anchor!)?.scrollIntoView({ behavior: 'smooth' }))}
                  aria-label="Ver membros"
                >
                  Ver <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function MemberList({ items, empty }: { items: { id: string; fullName: string; code: string; right: ReactNode }[]; empty: string }) {
  const { can } = useAuth();
  if (items.length === 0) return <p className="py-2 text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((m) => {
        const inner = (
          <>
            <Avatar name={m.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.fullName}</p>
              <p className="text-xs text-slate-500">{m.code}</p>
            </div>
            <span className="text-xs font-medium text-slate-500 tabular">{m.right}</span>
          </>
        );
        return (
          <li key={m.id}>
            {can('members:read') ? (
              <Link to={`/members/${m.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                {inner}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-1.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
