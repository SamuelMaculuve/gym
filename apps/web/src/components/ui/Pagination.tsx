import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onChange }: Props) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-800">
      <span className="text-slate-500 tabular dark:text-slate-400">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-slate-600 tabular dark:text-slate-300">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Página seguinte">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
