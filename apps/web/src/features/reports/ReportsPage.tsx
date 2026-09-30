import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  addDays,
  addMonths,
  formatDate,
  formatMonth,
  formatNumber,
  formatPhone,
  PAYMENT_METHOD_LABELS,
  startOfMonth,
  SUBSCRIPTION_STATUS_LABELS,
  type ReportQuery,
} from '@gymflow/shared';
import { ExportMenu } from '../../components/ExportMenu';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardBody, CardHeader, DataTable, DatePicker, EmptyState, LoadingState, Select, StatCard, SubscriptionBadge, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { qk } from '../../lib/query-keys';

type Kind = 'financial' | 'members' | 'attendance';
type GroupBy = NonNullable<ReportQuery['groupBy']>;

function periodLabel(period: string, groupBy: GroupBy) {
  if (groupBy === 'month') return formatMonth(period);
  if (groupBy === 'year') return period;
  if (groupBy === 'week') return `Sem. ${formatDate(period).slice(0, 5)}`;
  return formatDate(period).slice(0, 5);
}

/** Gráfico de barras de série única com tooltip. */
function SimpleBars({ data, format, label }: { data: { label: string; value: number; tooltip: string }[]; format?: (v: number) => string; label: string }) {
  return (
    <div className="h-64 text-slate-500 dark:text-slate-400" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: 'currentColor', fontSize: 11 }} tickFormatter={format} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <p className="font-medium text-slate-900 dark:text-white">{(payload[0].payload as { label: string }).label}</p>
                  <p className="text-slate-600 dark:text-slate-300">{(payload[0].payload as { tooltip: string }).tooltip}</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" fill="var(--color-series-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankList({ rows }: { rows: { label: string; value: number; display: ReactNode; sub?: ReactNode }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-slate-500">Sem dados no período.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">{r.label}</span>
            <span className="font-medium tabular">
              {r.display} {r.sub && <span className="text-xs font-normal text-slate-500">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--color-series-1)', minWidth: r.value ? 6 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ReportsPage() {
  const f = useFormat();
  const [kind, setKind] = useState<Kind>('financial');
  const [from, setFrom] = useState(startOfMonth(addMonths(f.today, -5)));
  const [to, setTo] = useState(f.today);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const query = { from, to, groupBy };

  const presets = [
    { label: 'Este mês', from: startOfMonth(f.today), groupBy: 'day' as const },
    { label: 'Últimos 30 dias', from: addDays(f.today, -29), groupBy: 'day' as const },
    { label: '6 meses', from: startOfMonth(addMonths(f.today, -5)), groupBy: 'month' as const },
    { label: '12 meses', from: startOfMonth(addMonths(f.today, -11)), groupBy: 'month' as const },
    { label: 'Este ano', from: `${f.today.slice(0, 4)}-01-01`, groupBy: 'month' as const },
  ];

  return (
    <>
      <PageHeader title="Relatórios" description="Financeiro, membros e presenças — exportáveis em CSV, Excel e PDF." />
      <Tabs className="mb-4" value={kind} onChange={setKind} items={[{ value: 'financial', label: 'Financeiro' }, { value: 'members', label: 'Membros' }, { value: 'attendance', label: 'Presenças' }]} />
      <Card className="mb-4">
        <CardBody className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
            <DatePicker label="De" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <DatePicker label="Até" value={to} min={from} max={f.today} onChange={(e) => setTo(e.target.value)} />
            {kind === 'financial' && (
              <Select
                label="Agrupar por"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                options={[{ value: 'day', label: 'Dia' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mês' }, { value: 'year', label: 'Ano' }]}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p.label} onClick={() => { setFrom(p.from); setTo(f.today); setGroupBy(p.groupBy); }} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
                {p.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
      {kind === 'financial' && <FinancialReportView query={query} />}
      {kind === 'members' && <MembersReportView query={query} />}
      {kind === 'attendance' && <AttendanceReportView query={query} />}
    </>
  );
}

function FinancialReportView({ query }: { query: ReportQuery & { groupBy: GroupBy } }) {
  const f = useFormat();
  const { data, isLoading } = useQuery({ queryKey: qk.reports('financial', query), queryFn: () => api.reports.financial(query) });
  if (isLoading || !data) return <LoadingState />;
  const avg = data.count ? Math.round(data.totalCents / data.count) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Receita no período" value={f.money(data.totalCents)} tone="brand" />
        <StatCard label="Pagamentos" value={data.count} />
        <StatCard label="Valor médio" value={f.money(avg)} />
        <StatCard label="Cancelado / estornado" value={f.money(data.refundedCents)} tone="red" />
      </div>
      <Card>
        <CardHeader
          title="Receita por período"
          actions={
            <ExportMenu
              options={() => ({
                filename: `receita_${data.from}_${data.to}`,
                title: 'Relatório financeiro',
                subtitle: `${formatDate(data.from)} a ${formatDate(data.to)} · Total ${f.money(data.totalCents)}`,
                rows: data.payments,
                columns: [
                  { header: 'Recibo', value: (p) => p.receiptNumber },
                  { header: 'Data', value: (p) => formatDate(p.paymentDate) },
                  { header: 'Membro', value: (p) => p.member?.fullName, width: 28 },
                  { header: 'Plano', value: (p) => p.planName },
                  { header: 'Método', value: (p) => PAYMENT_METHOD_LABELS[p.method] },
                  { header: 'Referência', value: (p) => p.reference },
                  { header: 'Valor (MT)', value: (p) => p.amountCents / 100 },
                ],
              })}
            />
          }
        />
        <CardBody>
          <SimpleBars
            label="Receita por período"
            format={(v) => (v >= 1000 ? `${formatNumber(v / 1000, v % 1000 ? 1 : 0)}k` : formatNumber(v))}
            data={data.series.map((s) => ({ label: periodLabel(s.period, data.groupBy), value: s.totalCents / 100, tooltip: `${f.money(s.totalCents)} · ${s.count} pagamento(s)` }))}
          />
        </CardBody>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Receita por plano" />
          <CardBody>
            <RankList rows={data.byPlan.map((p) => ({ label: p.planName, value: p.totalCents, display: f.money(p.totalCents), sub: `(${p.count})` }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Receita por método de pagamento" />
          <CardBody>
            <RankList rows={data.byMethod.map((m) => ({ label: PAYMENT_METHOD_LABELS[m.method], value: m.totalCents, display: f.money(m.totalCents), sub: `(${m.count})` }))} />
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Tabela" description="Valores por período" />
        <DataTable
          columns={[
            { key: 'p', header: 'Período', cell: (r) => periodLabel(r.period, data.groupBy) },
            { key: 'c', header: 'Pagamentos', align: 'right', cell: (r) => r.count },
            { key: 't', header: 'Receita', align: 'right', cell: (r) => f.money(r.totalCents) },
          ]}
          data={[...data.series].reverse()}
          rowKey={(r) => r.period}
        />
      </Card>
    </div>
  );
}

function MembersReportView({ query }: { query: ReportQuery }) {
  const { data, isLoading } = useQuery({ queryKey: qk.reports('members', query), queryFn: () => api.reports.members(query) });
  if (isLoading || !data) return <LoadingState />;
  const count = (s: string) => data.byStatus.find((b) => b.status === s)?.count ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Novos membros no período" value={data.newMembers.length} tone="blue" />
        <StatCard label="Activos" value={count('ACTIVE') + count('DUE_SOON')} tone="brand" />
        <StatCard label="Em atraso" value={count('OVERDUE')} tone="red" />
        <StatCard label="Expirados" value={count('EXPIRED')} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Membros por estado" />
          <CardBody>
            <RankList rows={data.byStatus.filter((b) => b.count > 0).map((b) => ({ label: b.status === 'NONE' ? 'Sem plano' : SUBSCRIPTION_STATUS_LABELS[b.status], value: b.count, display: b.count }))} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Novos membros"
            actions={
              <ExportMenu
                options={() => ({
                  filename: `membros_${data.from}_${data.to}`,
                  title: 'Relatório de membros',
                  subtitle: `Todos os membros · novos entre ${formatDate(data.from)} e ${formatDate(data.to)}: ${data.newMembers.length}`,
                  rows: data.members,
                  columns: [
                    { header: 'Número', value: (m) => m.code },
                    { header: 'Nome', value: (m) => m.fullName, width: 28 },
                    { header: 'Telefone', value: (m) => formatPhone(m.phone), width: 18 },
                    { header: 'Plano', value: (m) => m.planName },
                    { header: 'Inscrição', value: (m) => formatDate(m.joinedAt) },
                    { header: 'Vencimento', value: (m) => formatDate(m.endDate) },
                    { header: 'Estado', value: (m) => (m.status ? SUBSCRIPTION_STATUS_LABELS[m.status] : 'Sem plano') },
                  ],
                })}
              />
            }
          />
          <DataTable
            columns={[
              { key: 'n', header: 'Membro', cell: (m) => <div><p className="font-medium">{m.fullName}</p><p className="text-xs text-slate-500">{m.code}</p></div> },
              { key: 'p', header: 'Plano', cell: (m) => m.planName ?? '—' },
              { key: 'j', header: 'Inscrição', align: 'right', cell: (m) => formatDate(m.joinedAt) },
            ]}
            data={data.newMembers}
            rowKey={(m) => m.id}
            empty={<EmptyState title="Sem novos membros no período" />}
          />
        </Card>
      </div>
      <Card>
        <CardHeader title="Membros em atraso e expirados" />
        <DataTable
          columns={[
            { key: 'n', header: 'Membro', cell: (m) => <div><p className="font-medium">{m.fullName}</p><p className="text-xs text-slate-500">{m.code} · {formatPhone(m.phone)}</p></div> },
            { key: 'p', header: 'Plano', hideBelow: 'sm', cell: (m) => m.planName ?? '—' },
            { key: 'd', header: 'Vencimento', cell: (m) => formatDate(m.endDate) },
            { key: 's', header: 'Estado', cell: (m) => <SubscriptionBadge status={m.status} /> },
          ]}
          data={data.members.filter((m) => m.status === 'OVERDUE' || m.status === 'EXPIRED')}
          rowKey={(m) => m.id}
          empty={<EmptyState title="Nenhum membro em atraso" />}
        />
      </Card>
    </div>
  );
}

function AttendanceReportView({ query }: { query: ReportQuery }) {
  const { data, isLoading } = useQuery({ queryKey: qk.reports('attendance', query), queryFn: () => api.reports.attendance(query) });
  if (isLoading || !data) return <LoadingState />;
  const days = data.byDay.length || 1;
  const peak = [...data.byHour].sort((a, b) => b.count - a.count)[0];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Presenças no período" value={data.total} tone="brand" />
        <StatCard label="Média diária" value={(data.total / days).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} />
        <StatCard label="Membros distintos" value={data.byMember.length} />
        <StatCard label="Hora de pico" value={peak && peak.count ? `${String(peak.hour).padStart(2, '0')}h` : '—'} />
      </div>
      <Card>
        <CardHeader
          title="Presenças por dia"
          actions={
            <ExportMenu
              options={() => ({
                filename: `presencas_${data.from}_${data.to}`,
                title: 'Presenças por membro',
                subtitle: `${formatDate(data.from)} a ${formatDate(data.to)} · ${data.total} presenças`,
                rows: data.byMember,
                columns: [
                  { header: 'Número', value: (m) => m.code },
                  { header: 'Membro', value: (m) => m.fullName, width: 28 },
                  { header: 'Visitas', value: (m) => m.visits },
                  { header: 'Última visita', value: (m) => formatDate(m.lastVisit) },
                ],
              })}
            />
          }
        />
        <CardBody>
          <SimpleBars label="Presenças por dia" data={data.byDay.map((d) => ({ label: formatDate(d.date).slice(0, 5), value: d.count, tooltip: `${d.count} presença(s) em ${formatDate(d.date)}` }))} />
        </CardBody>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Presenças por hora de entrada" />
          <CardBody>
            <SimpleBars label="Presenças por hora" data={data.byHour.filter((h) => h.hour >= 5 && h.hour <= 22).map((h) => ({ label: `${h.hour}h`, value: h.count, tooltip: `${h.count} entrada(s) às ${h.hour}h` }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Presenças por membro" />
          <DataTable
            columns={[
              { key: 'n', header: 'Membro', cell: (m) => <div><p className="font-medium">{m.fullName}</p><p className="text-xs text-slate-500">{m.code}</p></div> },
              { key: 'v', header: 'Visitas', align: 'right', cell: (m) => m.visits },
              { key: 'l', header: 'Última', align: 'right', cell: (m) => formatDate(m.lastVisit) },
            ]}
            data={data.byMember.slice(0, 15)}
            rowKey={(m) => m.id}
            empty={<EmptyState title="Sem presenças" />}
          />
        </Card>
      </div>
    </div>
  );
}
