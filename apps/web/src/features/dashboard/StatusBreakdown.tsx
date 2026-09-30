import { AlertTriangle, CheckCircle2, Clock, PauseCircle, XCircle, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { SUBSCRIPTION_STATUS_LABELS, type MemberFilter, type SubscriptionStatus } from '@gymflow/shared';
import { Card, CardBody, CardHeader } from '../../components/ui';

/** Cores de estado reservadas (nunca usadas como cores de série) + ícone + rótulo. */
const STATUS_STYLE: Record<SubscriptionStatus, { color: string; icon: LucideIcon; filter?: MemberFilter }> = {
  ACTIVE: { color: 'var(--color-status-good)', icon: CheckCircle2, filter: 'up_to_date' },
  DUE_SOON: { color: 'var(--color-status-warning)', icon: Clock, filter: 'due_7_days' },
  OVERDUE: { color: 'var(--color-status-serious)', icon: AlertTriangle, filter: 'overdue' },
  EXPIRED: { color: 'var(--color-status-critical)', icon: XCircle, filter: 'inactive' },
  SUSPENDED: { color: '#94a3b8', icon: PauseCircle },
  CANCELLED: { color: '#cbd5e1', icon: XCircle },
};

export function StatusBreakdown({ data }: { data: { status: SubscriptionStatus; count: number }[] }) {
  const navigate = useNavigate();
  const rows = data.filter((d) => d.count > 0 || ['ACTIVE', 'DUE_SOON', 'OVERDUE', 'EXPIRED'].includes(d.status));
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <Card>
      <CardHeader title="Estado das subscrições" description={`${total} subscrições actuais`} />
      <CardBody>
        <ul className="space-y-3">
          {rows.map((r) => {
            const s = STATUS_STYLE[r.status];
            return (
              <li key={r.status}>
                <button
                  className="group w-full text-left"
                  onClick={() => (s.filter ? navigate(`/members?filter=${s.filter}`) : navigate(`/subscriptions?status=${r.status}`))}
                  title={`${SUBSCRIPTION_STATUS_LABELS[r.status]}: ${r.count}`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
                      <s.icon className="h-4 w-4" style={{ color: s.color }} />
                      {SUBSCRIPTION_STATUS_LABELS[r.status]}
                    </span>
                    <span className="font-medium text-slate-900 tabular dark:text-white">{r.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${(r.count / max) * 100}%`, background: s.color, minWidth: r.count ? 8 : 0 }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

/** Pagamentos: em dia / pendentes / em atraso — barra segmentada com legenda e valores. */
export function PaymentStatusCard({ data }: { data: { paid: number; pending: number; overdue: number } }) {
  const navigate = useNavigate();
  const total = Math.max(1, data.paid + data.pending + data.overdue);
  const segs = [
    { key: 'paid', label: 'Pagos (em dia)', value: data.paid, color: 'var(--color-status-good)', filter: 'up_to_date' },
    { key: 'pending', label: 'Pendentes (a vencer)', value: data.pending, color: 'var(--color-status-warning)', filter: 'due_7_days' },
    { key: 'overdue', label: 'Em atraso', value: data.overdue, color: 'var(--color-status-serious)', filter: 'overdue' },
  ];
  return (
    <Card>
      <CardHeader title="Pagamentos" description="Situação do período actual" />
      <CardBody className="space-y-4">
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={segs.map((s) => `${s.label}: ${s.value}`).join(', ')}>
          {segs.map((s) => s.value > 0 && <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />)}
        </div>
        <ul className="space-y-2">
          {segs.map((s) => (
            <li key={s.key}>
              <button onClick={() => navigate(`/members?filter=${s.filter}`)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-medium tabular">{s.value}</span>
              </button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
