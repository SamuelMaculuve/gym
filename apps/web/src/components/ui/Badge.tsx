import type { ReactNode } from 'react';
import {
  NOTIFICATION_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type NotificationStatus,
  type PaymentStatus,
  type SubscriptionStatus,
} from '@gymflow/shared';
import { cn } from '../../lib/cn';

export type Tone = 'gray' | 'green' | 'amber' | 'orange' | 'red' | 'blue' | 'violet';

const tones: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/15 dark:text-slate-300 dark:ring-slate-600',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/60',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:text-amber-300 dark:ring-amber-400/60',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:text-orange-300 dark:ring-orange-400/60',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:text-red-300 dark:ring-red-400/60',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:text-blue-300 dark:ring-blue-400/60',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:text-violet-300 dark:ring-violet-400/60',
};

const dots: Record<Tone, string> = {
  gray: 'bg-slate-400',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
};

export function Badge({ tone = 'gray', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset dark:bg-transparent', tones[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}

export const SUBSCRIPTION_TONES: Record<SubscriptionStatus, Tone> = {
  ACTIVE: 'green',
  DUE_SOON: 'amber',
  OVERDUE: 'red',
  EXPIRED: 'gray',
  SUSPENDED: 'violet',
  CANCELLED: 'gray',
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <Badge tone="gray">Sem plano</Badge>;
  return (
    <Badge tone={SUBSCRIPTION_TONES[status]} dot>
      {SUBSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={status === 'PAID' ? 'green' : status === 'REFUNDED' ? 'orange' : 'gray'}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function NotificationStatusBadge({ status }: { status: NotificationStatus }) {
  const tone: Tone = status === 'SENT' ? 'green' : status === 'FAILED' ? 'red' : status === 'PENDING' ? 'amber' : 'gray';
  return <Badge tone={tone}>{NOTIFICATION_STATUS_LABELS[status]}</Badge>;
}
