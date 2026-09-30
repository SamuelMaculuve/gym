import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirmar', tone = 'danger', loading, children }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 pt-1">
        <div className={tone === 'danger' ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15' : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15'}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
            {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
          </div>
          {children}
        </div>
      </div>
    </Modal>
  );
}
