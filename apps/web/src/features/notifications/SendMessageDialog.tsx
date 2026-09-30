import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  MEMBER_NOTIFICATION_TYPES,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPE_LABELS,
  type MemberDetail,
  type NotificationChannel,
  type NotificationType,
} from '@gymflow/shared';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useSendNotification } from './hooks';

export function SendMessageDialog({ member, open, onClose }: { member: MemberDetail; open: boolean; onClose: () => void }) {
  const send = useSendNotification();
  const [channels, setChannels] = useState<NotificationChannel[]>(['WHATSAPP']);
  const [type, setType] = useState<NotificationType>('CUSTOM');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) {
      setChannels(['WHATSAPP']);
      setType(member.currentSubscription?.status === 'OVERDUE' ? 'OVERDUE' : 'CUSTOM');
      setSubject('');
      setMessage('');
    }
  }, [open, member]);

  const available = (c: NotificationChannel) => (c === 'EMAIL' ? Boolean(member.email) : true);
  const toggle = (c: NotificationChannel) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const submit = async () => {
    try {
      const r = await send.mutateAsync({ memberId: member.id, channels, type, subject: subject || null, message: type === 'CUSTOM' ? message : null });
      const failed = r.filter((n) => n.status === 'FAILED').length;
      if (failed) toast.warning(`${r.length - failed} enviada(s), ${failed} falhou/falharam`);
      else toast.success('Mensagem enviada');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar mensagem"
      description={member.fullName}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={send.isPending} disabled={channels.length === 0 || (type === 'CUSTOM' && message.trim().length < 3)}>
            Enviar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium">Canais</span>
          <div className="flex flex-wrap gap-2">
            {NOTIFICATION_CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!available(c)}
                onClick={() => toggle(c)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40',
                  channels.includes(c) ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200' : 'border-slate-200 dark:border-slate-700',
                )}
              >
                {NOTIFICATION_CHANNEL_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
        <Select
          label="Tipo de mensagem"
          value={type}
          onChange={(e) => setType(e.target.value as NotificationType)}
          options={[{ value: 'CUSTOM', label: 'Mensagem personalizada' }, ...MEMBER_NOTIFICATION_TYPES.map((t) => ({ value: t, label: `Template: ${NOTIFICATION_TYPE_LABELS[t]}` }))]}
        />
        {type === 'CUSTOM' && (
          <>
            {channels.includes('EMAIL') && <Input label="Assunto (email)" value={subject} onChange={(e) => setSubject(e.target.value)} />}
            <Textarea label="Mensagem" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} hint="Pode usar {{name}}, {{plan}}, {{amount}}, {{due_date}}, {{gym_name}}, {{payment_link}}." />
          </>
        )}
      </div>
    </Modal>
  );
}
