import { AlertTriangle, CheckCircle2, Clock, PauseCircle, XCircle, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SUBSCRIPTION_STATUS_LABELS, type MemberFilter, type SubscriptionStatus } from '@gymflow/shared';
import { Card } from '../../components/ui';
import { cn } from '../../lib/cn';

/** Cores de estado reservadas (nunca usadas como cores de série) + ícone + rótulo. */
const STATUS_STYLE: Record<SubscriptionStatus, { color: string; icon: LucideIcon; filter?: MemberFilter }> = {
  ACTIVE: { color: 'var(--color-status-good)', icon: CheckCircle2, filter: 'up_to_date' },
  DUE_SOON: { color: 'var(--color-status-warning)', icon: Clock, filter: 'due_7_days' },
  OVERDUE: { color: 'var(--color-status-serious)', icon: AlertTriangle, filter: 'overdue' },
  EXPIRED: { color: 'var(--color-status-critical)', icon: XCircle, filter: 'inactive' },
  SUSPENDED: { color: '#94a3b8', icon: PauseCircle },
  CANCELLED: { color: '#cbd5e1', icon: XCircle },
};

/** Inclinações fixas dos chips (o efeito "espalhado" da referência, sem aleatoriedade). */
const TILT = ['-rotate-3', 'rotate-2', '-rotate-1', 'rotate-3', '-rotate-2', 'rotate-1'];

interface Chip {
  key: string;
  label: string;
  value: number;
  color: string;
  icon: LucideIcon;
  onClick: () => void;
}

type View = 'subs' | 'payments';

/** Estado das subscrições e dos pagamentos, como chips clicáveis + barra segmentada. */
export function StatusChips({
  subscriptions,
  payments,
}: {
  subscriptions: { status: SubscriptionStatus; count: number }[];
  payments: { paid: number; pending: number; overdue: number };
}) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('subs');

  const subChips: Chip[] = subscriptions
    .filter((d) => d.count > 0 || ['ACTIVE', 'DUE_SOON', 'OVERDUE', 'EXPIRED'].includes(d.status))
    .map((d) => {
      const s = STATUS_STYLE[d.status];
      return {
        key: d.status,
        label: SUBSCRIPTION_STATUS_LABELS[d.status],
        value: d.count,
        color: s.color,
        icon: s.icon,
        onClick: () => navigate(s.filter ? `/members?filter=${s.filter}` : `/subscriptions?status=${d.status}`),
      };
    });
  const payChips: Chip[] = [
    { key: 'paid', label: 'Pagos (em dia)', value: payments.paid, color: 'var(--color-status-good)', icon: CheckCircle2, onClick: () => navigate('/members?filter=up_to_date') },
    { key: 'pending', label: 'Pendentes', value: payments.pending, color: 'var(--color-status-warning)', icon: Clock, onClick: () => navigate('/members?filter=due_7_days') },
    { key: 'overdue', label: 'Em atraso', value: payments.overdue, color: 'var(--color-status-serious)', icon: AlertTriangle, onClick: () => navigate('/members?filter=overdue') },
  ];
  const chips = view === 'subs' ? subChips : payChips;
  const total = Math.max(1, chips.reduce((s, c) => s + c.value, 0));

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b border-slate-100 px-4 dark:border-slate-800" role="tablist">
        {(
          [
            ['subs', 'Subscrições'],
            ['payments', 'Pagamentos'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              '-mb-px border-b-2 px-3 py-3 text-sm font-medium transition-colors',
              view === v ? 'border-brand-500 text-slate-900 dark:border-brand-300 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-x-2 gap-y-3 px-4 py-6">
        {chips.map((c, i) => (
          <button
            key={c.key}
            onClick={c.onClick}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pr-3.5 pl-1.5 text-sm shadow-sm transition hover:rotate-0 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-500',
              TILT[i % TILT.length],
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-950/60">
              <c.icon className="h-3.5 w-3.5" style={{ color: c.color }} />
            </span>
            <span className="text-slate-700 dark:text-slate-200">{c.label}</span>
            <span className="font-semibold text-slate-900 tabular dark:text-white">{c.value}</span>
          </button>
        ))}
      </div>

      <div className="px-5 pb-5">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={chips.map((c) => `${c.label}: ${c.value}`).join(', ')}>
          {chips.map((c) => c.value > 0 && <div key={c.key} style={{ width: `${(c.value / total) * 100}%`, background: c.color }} />)}
        </div>
      </div>
    </Card>
  );
}
