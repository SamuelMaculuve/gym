import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn('scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1', className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            value === item.value
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-xs tabular', value === item.value ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700')}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
