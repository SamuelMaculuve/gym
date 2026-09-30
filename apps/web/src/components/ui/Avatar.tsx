import { initials } from '@gymflow/shared';
import { cn } from '../../lib/cn';

// Tons pastel, como os da referência (lima, lilás, laranja, menta, amarelo, rosa).
const COLORS = [
  'bg-lime-100 text-lime-900 dark:bg-brand-300 dark:text-slate-950',
  'bg-violet-100 text-violet-800 dark:bg-violet-300 dark:text-slate-950',
  'bg-orange-100 text-orange-800 dark:bg-orange-300 dark:text-slate-950',
  'bg-teal-100 text-teal-800 dark:bg-teal-200 dark:text-slate-950',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-200 dark:text-slate-950',
  'bg-rose-100 text-rose-800 dark:bg-rose-300 dark:text-slate-950',
];

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' };
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', COLORS[hash % COLORS.length], sizes[size], className)}>
      {initials(name)}
    </span>
  );
}
