import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { PaymentDTO } from '@gymflow/shared';
import { ConfirmDialog, Select, Textarea } from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useCancelPayment } from './hooks';

/** Pagamentos nunca são apagados: são cancelados ou estornados, mantendo o histórico. */
export function CancelPaymentDialog({ payment, onClose }: { payment: PaymentDTO | null; onClose: () => void }) {
  const f = useFormat();
  const cancel = useCancelPayment();
  const [status, setStatus] = useState<'CANCELLED' | 'REFUNDED'>('CANCELLED');
  const [reason, setReason] = useState('');
  useEffect(() => {
    setStatus('CANCELLED');
    setReason('');
  }, [payment]);

  const confirm = async () => {
    if (!payment) return;
    if (reason.trim().length < 3) return toast.error('Indique o motivo');
    try {
      await cancel.mutateAsync({ id: payment.id, input: { status, reason } });
      toast.success(status === 'REFUNDED' ? 'Pagamento estornado' : 'Pagamento cancelado');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(payment)}
      onClose={onClose}
      onConfirm={confirm}
      loading={cancel.isPending}
      title={`Anular pagamento ${payment?.receiptNumber ?? ''}`}
      description={payment && `${f.money(payment.amountCents)} de ${payment.member?.fullName ?? 'membro'}. O registo fica no histórico e a subscrição volta a ficar por pagar.`}
      confirmLabel="Confirmar anulação"
    >
      <div className="space-y-3">
        <Select
          label="Tipo"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'CANCELLED' | 'REFUNDED')}
          options={[
            { value: 'CANCELLED', label: 'Cancelar (registo errado)' },
            { value: 'REFUNDED', label: 'Estornar (valor devolvido)' },
          ]}
        />
        <Textarea label="Motivo" required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </ConfirmDialog>
  );
}
