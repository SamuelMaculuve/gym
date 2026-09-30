import { Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800', className)} />;
}

export function LoadingState({ label = 'A carregar…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-16 text-sm text-slate-500', className)}>
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-40' : 'w-24', c > 2 && 'hidden md:block')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-sm">
      <p className="text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button className="font-medium text-brand-700 hover:underline dark:text-brand-400" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
