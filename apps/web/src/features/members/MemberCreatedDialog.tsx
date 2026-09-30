import { CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { formatDate, type MemberCreateResponse } from '@gymflow/shared';
import { QrCodeCard } from '../../components/QrCodeCard';
import { Button, Modal } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useMemberQr } from './hooks';

/** Último passo do fluxo de inscrição: confirmação + QR Code pronto a imprimir. */
export function MemberCreatedDialog({ result, onClose, onRegisterPayment }: { result: MemberCreateResponse | null; onClose: () => void; onRegisterPayment: (memberId: string) => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const qr = useMemberQr(result?.member.id);
  if (!result) return null;
  const { member, subscription, payment } = result;

  return (
    <Modal open onClose={onClose} title="Membro cadastrado" size="md">
      <div className="space-y-5 pb-2">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium">
              {member.fullName} — {member.code}
            </p>
            {subscription && (
              <p className="mt-0.5 opacity-80">
                {subscription.plan.name}: {formatDate(subscription.startDate)} → {formatDate(subscription.endDate)}
                {payment ? ' · pagamento registado' : ' · pagamento pendente'}
              </p>
            )}
          </div>
        </div>
        <QrCodeCard qr={qr.data} />
        <div className="flex flex-col gap-2 sm:flex-row">
          {subscription && !payment && can('payments:write') && (
            <Button className="flex-1" onClick={() => onRegisterPayment(member.id)}>
              Registar pagamento
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => { onClose(); navigate(`/members/${member.id}`); }}>
            Ver perfil
          </Button>
          <Button variant={payment ? 'primary' : 'outline'} className="flex-1" onClick={onClose}>
            Concluir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
