import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMonth, formatNumber } from '@gymflow/shared';
import { Card, CardBody, CardHeader, Tabs } from '../../components/ui';
import { useFormat } from '../../lib/format';

interface Props {
  data: { month: string; totalCents: number; count: number }[];
}

/** Receita mensal — série única (sem legenda; o título identifica-a). */
export function RevenueChart({ data }: Props) {
  const f = useFormat();
  const [range, setRange] = useState<'6' | '12'>('6');
  const rows = data.slice(-Number(range)).map((d) => ({ ...d, label: formatMonth(d.month, false), value: d.totalCents / 100 }));
  const total = rows.reduce((s, r) => s + r.totalCents, 0);

  return (
    <Card>
      <CardHeader
        title="Receita"
        description={`${f.money(total)} nos últimos ${range} meses`}
        actions={<Tabs value={range} onChange={setRange} items={[{ value: '6', label: '6 meses' }, { value: '12', label: '12 meses' }]} />}
      />
      <CardBody className="pt-2">
        <div className="h-64 text-slate-500 dark:text-slate-400" role="img" aria-label="Gráfico de receita mensal">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 12, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: 'currentColor', fontSize: 12 }}
                tickFormatter={(v: number) => (v >= 1000 ? `${formatNumber(v / 1000, v % 1000 ? 1 : 0)}k` : formatNumber(v))}
              />
              <Tooltip
                cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof rows)[number];
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <p className="font-medium text-slate-900 dark:text-white">{formatMonth(p.month)}</p>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                        {f.money(p.totalCents)} · {p.count} pagamento(s)
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" fill="var(--color-series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}
