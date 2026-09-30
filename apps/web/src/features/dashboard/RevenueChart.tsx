import { useState } from 'react';
import { formatMonth } from '@gymflow/shared';
import { Card, Tabs } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useFormat } from '../../lib/format';

interface Props {
  data: { month: string; totalCents: number; count: number }[];
  prevMonthCents: number;
}

/**
 * Receita mensal em barras "pílula" — série única, um só tom (lima).
 * O mês seleccionado fica sólido, os restantes tracejados; o mês de pico leva 🔥.
 */
export function RevenueChart({ data, prevMonthCents }: Props) {
  const f = useFormat();
  const [range, setRange] = useState<'6' | '12'>('6');
  const rows = data.slice(-Number(range));
  const [picked, setPicked] = useState<number | null>(null);
  const active = picked !== null && picked < rows.length ? picked : rows.length - 1;
  const max = Math.max(1, ...rows.map((r) => r.totalCents));
  const peak = rows.findIndex((r) => r.totalCents === max && r.totalCents > 0);
  const total = rows.reduce((s, r) => s + r.totalCents, 0);
  const cur = rows[active];
  const n = rows.length;

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-medium tracking-tight text-slate-900 dark:text-white">Receita</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {f.money(total)} nos últimos {range} meses · mês anterior {f.money(prevMonthCents)}
          </p>
        </div>
        <Tabs value={range} onChange={(v) => { setRange(v); setPicked(null); }} items={[{ value: '6', label: '6 meses' }, { value: '12', label: '12 meses' }]} />
      </div>

      <div className="relative mt-4 flex min-h-52 flex-1 flex-col" onMouseLeave={() => setPicked(null)}>
        {cur && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-44 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur transition-[left] duration-200 dark:border-slate-700 dark:bg-slate-800/85"
            style={{ left: `clamp(0px, calc(${((active + 0.5) / n) * 100}% - 88px), calc(100% - 176px))` }}
            aria-live="polite"
          >
            <p className="text-base font-medium text-slate-900 capitalize dark:text-white">{formatMonth(cur.month)}</p>
            <dl className="mt-1.5 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 dark:bg-brand-300" /> Receita
                </dt>
                <dd className="font-medium text-slate-900 tabular dark:text-white">{f.money(cur.totalCents)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="pl-3 text-slate-500 dark:text-slate-400">Pagamentos</dt>
                <dd className="font-medium text-slate-900 tabular dark:text-white">{cur.count}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-auto flex h-44 items-end gap-2 sm:gap-3" role="group" aria-label="Receita mensal">
          {rows.map((r, i) => {
            const on = i === active;
            const h = Math.max(14, (r.totalCents / max) * 100);
            return (
              <button
                key={r.month}
                type="button"
                onMouseEnter={() => setPicked(i)}
                onFocus={() => setPicked(i)}
                onClick={() => setPicked(i)}
                aria-label={`${formatMonth(r.month)}: ${f.money(r.totalCents)}, ${r.count} pagamento(s)`}
                aria-pressed={on}
                className="group flex h-full flex-1 flex-col items-center justify-end focus-visible:outline-none"
              >
                {i === peak && <span className="mb-1 text-sm leading-none" aria-hidden>🔥</span>}
                <span
                  className={cn(
                    'w-full max-w-12 rounded-full transition-all duration-300 group-focus-visible:ring-2 group-focus-visible:ring-brand-400',
                    on ? 'bg-brand-400 dark:bg-brand-300' : 'hatch bg-slate-100 text-slate-300 group-hover:text-slate-400 dark:bg-slate-800/70 dark:text-slate-700 dark:group-hover:text-slate-600',
                  )}
                  style={{ height: `${h}%` }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2 sm:gap-3">
          {rows.map((r, i) => (
            <span key={r.month} className={cn('flex-1 text-center text-xs capitalize', i === active ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-500')}>
              {formatMonth(r.month, false)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
