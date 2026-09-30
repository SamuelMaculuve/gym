import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { EmptyState, TableSkeleton } from './States';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Chave de ordenação (se a coluna for ordenável). */
  sortKey?: string;
  className?: string;
  /** Esconde a coluna abaixo de um breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  align?: 'left' | 'right';
}

interface Props<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  loading?: boolean;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sort?: { key: string; order: 'asc' | 'desc' };
  onSortChange?: (key: string) => void;
  empty?: ReactNode;
  /** Renderização compacta para mobile (cartões). */
  mobileCard?: (row: T) => ReactNode;
  footer?: ReactNode;
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell', '2xl': 'hidden 2xl:table-cell' };

/** Tabela responsiva: colunas adaptáveis no desktop e cartões no mobile. */
export function DataTable<T>({ columns, data, loading, rowKey, onRowClick, sort, onSortChange, empty, mobileCard, footer }: Props<T>) {
  if (loading && !data) return <TableSkeleton cols={Math.min(columns.length, 6)} />;
  if (!data || data.length === 0) return <>{empty ?? <EmptyState title="Sem registos" description="Não há dados para mostrar." />}</>;

  return (
    <>
      {mobileCard && (
        <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
          {data.map((row) => (
            <li key={rowKey(row)}>
              <div
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => e.key === 'Enter' && onRowClick?.(row)}
                className={cn('px-4 py-3', onRowClick && 'cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/50')}
              >
                {mobileCard(row)}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={cn('relative overflow-x-auto scrollbar-thin', mobileCard && 'hidden md:block', loading && 'opacity-60')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {columns.map((c) => {
                const active = sort && c.sortKey === sort.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium tracking-wide whitespace-nowrap text-slate-500 uppercase dark:text-slate-400',
                      c.align === 'right' && 'text-right',
                      c.hideBelow && hide[c.hideBelow],
                      c.className,
                    )}
                  >
                    {c.sortKey && onSortChange ? (
                      <button className="inline-flex items-center gap-1 uppercase hover:text-slate-800 dark:hover:text-slate-200" onClick={() => onSortChange(c.sortKey!)}>
                        {c.header}
                        {active ? (
                          sort.order === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle text-slate-700 dark:text-slate-300 [&_.tabular]:whitespace-nowrap', c.align === 'right' && 'text-right tabular', c.hideBelow && hide[c.hideBelow], c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </>
  );
}
