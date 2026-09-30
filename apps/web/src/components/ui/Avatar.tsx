import { initials } from '@gymflow/shared';
import { cn } from '../../lib/cn';

const COLORS = ['bg-emerald-100 text-emerald-800', 'bg-blue-100 text-blue-800', 'bg-violet-100 text-violet-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-cyan-100 text-cyan-800'];

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' };
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', COLORS[hash % COLORS.length], sizes[size], className)}>
      {initials(name)}
    </span>
  );
}
