import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BellRing, CalendarCheck, CircleDollarSign, Plus, TrendingDown, TrendingUp, UserCheck, AlertTriangle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate, formatMonth, PAYMENT_METHOD_LABELS, type MemberSort } from '@gymflow/shared';
import { Avatar, Button, Card, EmptyState, ErrorState, SearchInput, Skeleton, SubscriptionBadge } from '../../components/ui';
import { useQuickActions } from '../../app/QuickActions';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { qk } from '../../lib/query-keys';
import { useMembers } from '../members/hooks';
import { RevenueChart } from './RevenueChart';
import { StatusChips } from './StatusBreakdown';

export function DashboardPage() {
  const f = useFormat();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: qk.dashboard, queryFn: api.dashboard.summary, refetchInterval: 120_000 });

  if (error) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const t = data?.totals;
  const delta = t && t.revenuePrevMonthCents > 0 ? Math.round(((t.revenueThisMonthCents - t.revenuePrevMonthCents) / t.revenuePrevMonthCents) * 100) : null;
  const canMembers = can('members:read');
  const go = (filter: string) => (canMembers ? () => navigate(`/members?filter=${filter}`) : undefined);

  return (
    // Desktop: coluna esquerda (saudação + cartões de apoio) e área principal à direita.
    // Mobile: saudação, depois indicadores, e os cartões de apoio no fim.
    <div className="grid gap-6 xl:grid-cols-12 xl:grid-rows-[auto_1fr]">
      <div className="xl:col-span-3">
        <Hero />
      </div>

      <aside className="order-last flex flex-col gap-5 xl:order-none xl:col-span-3 xl:col-start-1 xl:row-start-2">
        {t ? <AttendanceDots today={t.attendanceToday} week={t.attendanceThisWeek} active={t.activeMembers} /> : <Skeleton className="h-64 rounded-2xl" />}
        {t && <ReminderCard due={t.dueToday + t.dueNext7Days} onOpen={go('due_7_days')} />}
      </aside>

      {/* Área principal */}
      <div className="flex min-w-0 flex-col gap-6 xl:col-span-9 xl:col-start-4 xl:row-span-2 xl:row-start-1">
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-5">
            {isLoading || !t ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)
            ) : (
              <>
                <Tile
                  icon={<CircleDollarSign className="h-4 w-4" />}
                  label="Receita"
                  value={f.money(t.revenueThisMonthCents)}
                  sub="Este mês"
                  pill={delta !== null ? { up: delta >= 0, text: `${delta > 0 ? '+' : ''}${delta}%` } : undefined}
                  onClick={can('payments:read') ? () => navigate('/payments') : undefined}
                />
                <Tile
                  icon={<UserCheck className="h-4 w-4" />}
                  label="Membros"
                  value={t.activeMembers}
                  sub={`Activos de ${t.members}`}
                  pill={t.newMembersThisMonth > 0 ? { up: true, text: `+${t.newMembersThisMonth}` } : undefined}
                  onClick={go('active')}
                />
                <Tile
                  icon={<CalendarCheck className="h-4 w-4" />}
                  label="Presenças"
                  value={t.attendanceToday}
                  sub={`Hoje · ${t.attendanceThisWeek} esta semana`}
                  onClick={can('attendance:read') ? () => navigate('/attendance') : undefined}
                />
                <Tile
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label="Em atraso"
                  value={t.overdue}
                  sub={`${t.dueToday} vencem hoje`}
                  pill={t.overdue > 0 ? { up: false, text: 'atenção' } : undefined}
                  onClick={go('overdue')}
                />
              </>
            )}
          </div>
          <div className="lg:col-span-7">{data ? <RevenueChart data={data.revenueByMonth} prevMonthCents={data.totals.revenuePrevMonthCents} /> : <Skeleton className="h-full min-h-72 rounded-2xl" />}</div>
        </div>

        {data && t && (
          <div className="grid gap-6 lg:grid-cols-12">
            <section className="lg:col-span-7">
              <SectionTitle>Acções necessárias</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <ActionTile count={t.overdue} text={() => 'com pagamento em atraso'} highlight onClick={go('overdue')} />
                <ActionTile count={t.dueToday} text={(n) => (n === 1 ? 'vence hoje' : 'vencem hoje')} onClick={go('due_today')} />
                <ActionTile count={t.dueNext7Days} text={() => 'a vencer em 7 dias'} onClick={go('due_7_days')} />
                <ActionTile
                  count={data.inactiveAttendees.length}
                  text={() => 'sem treinar há 7+ dias'}
                  onClick={() => document.getElementById('frequencia')?.scrollIntoView({ behavior: 'smooth' })}
                />
              </div>
            </section>
            <section className="flex flex-col lg:col-span-5">
              <SectionTitle>Estado actual</SectionTitle>
              <div className="flex-1">
                <StatusChips subscriptions={data.subscriptionStatus} payments={data.paymentStatus} />
              </div>
            </section>
          </div>
        )}

        {canMembers && <MembersTable />}

        {data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" id="frequencia">
            <ListCard title="Mais frequentes" description="Últimos 30 dias">
              <MemberList items={data.topAttendees.map((m) => ({ ...m, right: `${m.visits} visitas` }))} empty="Sem presenças recentes." />
            </ListCard>
            <ListCard title="Não treinam há 7+ dias" description="Membros activos para contactar">
              <MemberList
                items={data.inactiveAttendees.map((m) => ({ ...m, right: m.days === null ? 'Nunca visitou' : `${m.days} dias` }))}
                empty="Todos os membros activos treinaram esta semana. 💪"
              />
            </ListCard>
            {can('payments:read') && (
              <ListCard title="Últimos pagamentos" action={<Link to="/payments" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">Ver todos</Link>}>
                {data.recentPayments.length === 0 ? (
                  <EmptyState title="Sem pagamentos" className="py-6" />
                ) : (
                  <ul className="space-y-1">
                    {data.recentPayments.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 py-1.5">
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
              </ListCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Relógio que actualiza a cada minuto, no fuso do ginásio. */
function useNow(timeZone: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  return `${p.day} ${formatMonth(`${p.year}-${p.month}`)}, ${p.hour}:${p.minute}`;
}

function Hero() {
  const f = useFormat();
  const { user, can } = useAuth();
  const quick = useQuickActions();
  const now = useNow(f.timezone);
  return (
    <div>
      <h1 className="text-4xl leading-[1.1] font-medium tracking-tight text-slate-900 sm:text-[2.6rem] dark:text-white">
        Gerir o seu{' '}
        <span className="relative inline-block">
          ginásio
          <svg className="absolute -bottom-2 left-0 h-3 w-full text-orange-400" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden>
            <path d="M2 8 C 30 2, 60 11, 118 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </span>
      </h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        Olá, {user?.name.split(' ')[0]} · {now}
      </p>
      <div className="mt-5 grid gap-2.5">
        {can('members:write') && (
          <Button size="lg" icon={<Plus className="h-5 w-5" />} onClick={quick.openNewMember} className="w-full">
            Novo membro
          </Button>
        )}
        {can('attendance:write') && (
          <Button size="lg" variant="outline" onClick={quick.openCheckIn} className="w-full">
            Check-in rápido
          </Button>
        )}
        {can('payments:write') && (
          <Button size="lg" variant="ghost" onClick={() => quick.openPayment()} className="w-full">
            Registar pagamento
          </Button>
        )}
      </div>
    </div>
  );
}

/** Grelha de pontos: cada ponto é uma fracção dos membros activos; acesos = treinaram hoje. */
function AttendanceDots({ today, week, active }: { today: number; week: number; active: number }) {
  const { can } = useAuth();
  const DOTS = 70;
  const rate = active > 0 ? Math.min(1, today / active) : 0;
  const lit = Math.round(rate * DOTS);
  // Espalha os pontos acesos de forma estável (passo coprimo com 70).
  const on = new Set(Array.from({ length: lit }, (_, i) => (i * 23 + 7) % DOTS));
  const label = [...on].sort((a, b) => a - b)[Math.floor(lit / 2)];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium tracking-tight">Presenças hoje</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{week} check-ins esta semana</p>
        </div>
        {can('attendance:read') && (
          <Link to="/attendance" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Ver presenças">
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="relative mt-5 grid grid-cols-10 gap-x-2 gap-y-3" role="img" aria-label={`${today} de ${active} membros activos treinaram hoje`}>
        {Array.from({ length: DOTS }, (_, i) => (
          <span key={i} className="relative flex justify-center">
            <span className={cn('h-2 w-2 rounded-full', on.has(i) ? 'bg-brand-400 dark:bg-brand-300' : 'bg-slate-200 dark:bg-slate-700/70')} />
            {i === label && today > 0 && (
              <span className="absolute -top-7 z-10 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-900 shadow-md">💪 {today} hoje</span>
            )}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
        <span className="text-slate-500 italic dark:text-slate-400">Taxa de presença</span>
        <span className="font-semibold text-brand-700 italic tabular dark:text-brand-300">{Math.round(rate * 100)}%</span>
      </div>
    </Card>
  );
}

function ReminderCard({ due, onOpen }: { due: number; onOpen?: () => void }) {
  const { can } = useAuth();
  if (!can('notifications:write') && !onOpen) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 p-5 text-white">
      <BellRing className="absolute -top-2 -right-4 h-32 w-32 rotate-12 text-white/15" aria-hidden />
      <p className="relative text-2xl leading-tight font-medium">{due > 0 ? `${due} a vencer` : 'Tudo em dia'}</p>
      <p className="relative mt-2 max-w-[16rem] text-sm text-violet-100">
        {due > 0 ? 'Subscrições que vencem hoje ou nos próximos 7 dias. Envie um lembrete antes que atrasem.' : 'Nenhuma subscrição vence nos próximos 7 dias.'}
      </p>
      {due > 0 && onOpen && (
        <button onClick={onOpen} className="relative mt-4 h-11 w-full rounded-xl bg-white text-sm font-semibold text-slate-900 hover:bg-violet-50">
          Ver membros
        </button>
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub, pill, onClick }: { icon: ReactNode; label: string; value: ReactNode; sub: string; pill?: { up: boolean; text: string }; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-900/60',
        onClick && 'transition hover:border-slate-300 dark:hover:border-slate-600',
      )}
    >
      <span className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{icon}</span>
        {label}
      </span>
      <span className="mt-4 flex flex-wrap items-center gap-2">
        <span className="truncate text-xl font-medium tracking-tight text-slate-900 tabular sm:text-2xl dark:text-white">{value}</span>
        {pill && (
          <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', pill.up ? 'bg-emerald-400 text-emerald-950' : 'bg-red-400 text-red-950')}>
            {pill.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pill.text}
          </span>
        )}
      </span>
      <span className="mt-1 truncate text-xs text-slate-500">{sub}</span>
    </Comp>
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-2xl font-medium tracking-tight text-slate-900 dark:text-white">{children}</h2>
      {action}
    </div>
  );
}

function ActionTile({ count, text, highlight, onClick }: { count: number; text: (n: number) => string; highlight?: boolean; onClick?: () => void }) {
  const idle = count === 0;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="group relative flex min-h-32 flex-col justify-end rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition enabled:hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:enabled:hover:border-slate-600"
    >
      <span
        className={cn(
          'absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full transition',
          highlight && !idle ? 'bg-brand-300 text-slate-950' : 'bg-slate-100 text-slate-500 group-hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:text-white',
        )}
        aria-hidden
      >
        <ArrowUpRight className="h-4 w-4" />
      </span>
      <span className={cn('text-4xl font-medium tracking-tight tabular', idle ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white')}>{count}</span>
      <span className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{text(count)}</span>
    </button>
  );
}

const SORTS: { value: MemberSort; label: string; order: 'asc' | 'desc' }[] = [
  { value: 'dueDate', label: 'Vencimento', order: 'asc' },
  { value: 'name', label: 'Nome', order: 'asc' },
  { value: 'joinedAt', label: 'Mais recentes', order: 'desc' },
  { value: 'lastPayment', label: 'Último pagamento', order: 'desc' },
];

/** Lista curta de membros (a vencer primeiro), como a tabela "All Members" da referência. */
function MembersTable() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<MemberSort>('dueDate');
  const order = SORTS.find((s) => s.value === sort)!.order;
  const { data, isLoading } = useMembers({ q: q || undefined, filter: 'active', sort, order, page: 1, pageSize: 6 });
  const th = 'px-4 pb-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase';

  return (
    <section>
      <SectionTitle action={<Link to="/members" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Ver todos</Link>}>Membros</SectionTitle>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Pesquisar membros" className="w-full sm:w-72" />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Ordenar por:
          <select value={sort} onChange={(e) => setSort(e.target.value as MemberSort)} className="cursor-pointer bg-transparent font-medium text-slate-900 focus:outline-none dark:text-white">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-white dark:bg-slate-900">
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : !data?.items.length ? (
        <EmptyState title="Sem membros" description={q ? 'Nenhum membro corresponde à pesquisa.' : 'Ainda não há membros activos.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-1.5 text-sm">
            <thead>
              <tr>
                <th className={th}>Membro</th>
                <th className={th}>Vencimento</th>
                <th className={cn(th, 'hidden lg:table-cell')}>Plano</th>
                <th className={th}>Estado</th>
                <th className={cn(th, 'hidden md:table-cell')}>Telefone</th>
                <th className={cn(th, 'hidden text-right sm:table-cell')}>Último pagamento</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr
                  key={m.id}
                  tabIndex={0}
                  onClick={() => navigate(`/members/${m.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/members/${m.id}`)}
                  className="group cursor-pointer [&>td]:bg-transparent [&>td]:transition-colors [&>td:first-child]:rounded-l-2xl [&>td:last-child]:rounded-r-2xl hover:[&>td]:bg-slate-100 focus-visible:outline-none focus-visible:[&>td]:bg-slate-100 dark:hover:[&>td]:bg-slate-900 dark:focus-visible:[&>td]:bg-slate-900"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar name={m.fullName} />
                      <span className="min-w-0">
                        <span className="block truncate text-base font-medium text-slate-900 dark:text-white">{m.fullName}</span>
                        <span className="block truncate text-xs text-slate-500">{m.email ?? m.code}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular">{formatDate(m.dueDate)}</td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell dark:text-slate-300">{m.planName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <SubscriptionBadge status={m.status} />
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap tabular md:table-cell">{m.phone}</td>
                  <td className="hidden px-4 py-3 text-right whitespace-nowrap text-slate-600 sm:table-cell dark:text-slate-300">{formatDate(m.lastPaymentDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ListCard({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium tracking-tight">{title}</h3>
          {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      {children}
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
              <Link to={`/members/${m.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
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
