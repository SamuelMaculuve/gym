import { AlertTriangle, BellRing, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatDate, formatPhone, NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS, type ReminderSendResult } from '@gymflow/shared';
import { Button, EmptyState, LoadingState, Modal, SubscriptionBadge } from '../../components/ui';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useMember } from '../members/hooks';
import { useSendReminder } from './hooks';

type Kind = 'reminder' | 'warning';

/** Envio manual e individual de um lembrete de vencimento ou aviso de atraso. */
export function SendReminderDialog({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const member = useMember(memberId ?? undefined);
  const send = useSendReminder();
  const [kind, setKind] = useState<Kind>('reminder');
  const [result, setResult] = useState<ReminderSendResult | null>(null);
  const sub = member.data?.currentSubscription ?? null;
  const late = Boolean(sub && sub.daysUntilDue < 0);

  useEffect(() => {
    setResult(null);
    setKind(late ? 'warning' : 'reminder');
  }, [memberId, late]);

  const submit = async () => {
    if (!memberId) return;
    try {
      const r = await send.mutateAsync({ memberId, kind });
      setResult(r);
      if (r.sent > 0 && r.failed === 0) toast.success('Lembrete enviado');
      else if (r.sent > 0) toast.warning(`${r.sent} enviado(s), ${r.failed} falhado(s)`);
      else if (r.failed > 0) toast.error('O envio falhou');
      else toast.info('Nenhuma mensagem foi enviada');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const options: { value: Kind; title: string; description: string }[] = [
    {
      value: 'reminder',
      title: 'Lembrete de vencimento',
      description: !sub ? '' : late ? 'Disponível apenas antes do vencimento.' : sub.daysUntilDue === 0 ? 'A subscrição vence hoje.' : `Vencimento a ${formatDate(sub.dueDate)}.`,
    },
    {
      value: 'warning',
      title: 'Aviso de pagamento em atraso',
      description: sub && late ? `Em atraso há ${sub.daysOverdue} dia(s), desde ${formatDate(sub.dueDate)}.` : 'Disponível apenas depois do vencimento.',
    },
  ];

  return (
    <Modal
      open={Boolean(memberId)}
      onClose={onClose}
      title="Enviar lembrete"
      description="Envio imediato para este membro, pelos canais activos (WhatsApp / email)."
      footer={
        result ? (
          <Button onClick={onClose}>Fechar</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button icon={<BellRing className="h-4 w-4" />} onClick={submit} loading={send.isPending} disabled={!sub || sub.state === 'CANCELLED' || !member.data?.notificationsEnabled}>
              Enviar agora
            </Button>
          </>
        )
      }
    >
      {member.isLoading ? (
        <LoadingState />
      ) : !member.data ? (
        <EmptyState title="Membro não encontrado" />
      ) : (
        <div className="space-y-4 pb-1">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{member.data.fullName}</p>
              <p className="text-xs text-slate-500">
                {formatPhone(member.data.phone)}
                {sub && ` · ${sub.plan.name} · vence ${formatDate(sub.endDate)}`}
              </p>
            </div>
            <SubscriptionBadge status={sub?.status ?? null} />
          </div>

          {!member.data.notificationsEnabled && (
            <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" /> As notificações estão desactivadas para este membro. Active-as no perfil (menu ⋮).
            </p>
          )}
          {(!sub || sub.state === 'CANCELLED') && <p className="text-sm text-slate-500">O membro não tem uma subscrição activa.</p>}

          {result ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{NOTIFICATION_TYPE_LABELS[result.type]}</p>
              {result.notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  {n.status === 'SENT' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : n.status === 'FAILED' ? (
                    <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                  ) : (
                    <MinusCircle className="h-5 w-5 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">
                      {NOTIFICATION_CHANNEL_LABELS[n.channel]} → {n.channel === 'EMAIL' ? n.recipient : formatPhone(n.recipient)}
                    </p>
                    <p className="text-xs text-slate-500">{n.status === 'SENT' ? 'Enviada' : n.status === 'FAILED' ? 'Falhou' : 'Ignorada'}{n.error ? ` — ${n.error}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            sub &&
            sub.state !== 'CANCELLED' && (
              <div className="grid gap-2" role="radiogroup" aria-label="Tipo de mensagem">
                {options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={kind === o.value}
                    disabled={(o.value === 'warning') !== late}
                    onClick={() => setKind(o.value)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                      kind === o.value ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-900/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
                    )}
                  >
                    <p className="text-sm font-semibold">
                      {o.title}
                    </p>
                    <p className="text-xs text-slate-500">{o.description}</p>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </Modal>
  );
}
