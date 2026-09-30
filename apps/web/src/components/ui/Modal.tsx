import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Foca o primeiro campo do diálogo
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea,button[data-autofocus]');
      (el ?? ref.current)?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}

const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/** Diálogo centrado no desktop; folha inferior no mobile. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: OverlayProps) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={cn(
          'animate-slide-up relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl dark:bg-slate-900',
          widths[size],
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
            </div>
            <button onClick={onClose} aria-label="Fechar" className="-mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Painel lateral para formulários longos (ecrã inteiro no mobile). */
export function Drawer({ open, onClose, title, description, children, footer }: OverlayProps) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="animate-slide-in relative flex h-full w-full flex-col bg-white shadow-2xl outline-none sm:max-w-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="-mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="pb-safe flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
