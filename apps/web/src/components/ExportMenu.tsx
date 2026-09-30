import { Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { exportCSV, exportExcel, exportPDF, type ExportOptions } from '../lib/export';
import { Button } from './ui';

/** Botão "Exportar" com opções CSV, Excel e PDF. */
export function ExportMenu<T>({ options, disabled }: { options: () => ExportOptions<T> | Promise<ExportOptions<T>>; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const run = async (kind: 'csv' | 'xlsx' | 'pdf') => {
    setOpen(false);
    try {
      const o = await options();
      if (o.rows.length === 0) return toast.info('Não há dados para exportar');
      if (kind === 'csv') exportCSV(o);
      else if (kind === 'xlsx') await exportExcel(o);
      else await exportPDF(o);
      toast.success('Ficheiro exportado');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível exportar');
    }
  };

  const item = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => setOpen((o) => !o)} disabled={disabled}>
        Exportar
      </Button>
      {open && (
        <div className="animate-fade-in absolute right-0 z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button className={item} onClick={() => run('csv')}>
            <FileText className="h-4 w-4" /> CSV
          </button>
          <button className={item} onClick={() => run('xlsx')}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button className={item} onClick={() => run('pdf')}>
            <Sheet className="h-4 w-4" /> PDF
          </button>
        </div>
      )}
    </div>
  );
}
