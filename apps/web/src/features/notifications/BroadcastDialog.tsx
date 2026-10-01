import { AlertTriangle, Info, Mail, MessageCircle, Smartphone, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BROADCAST_AUDIENCES, MEMBER_FILTER_LABELS, type BroadcastAudience, type NotificationChannel } from '@gymflow/shared';
import { Button, Input, Modal, Select, Skeleton, Textarea } from '../../components/ui';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useBroadcast, useBroadcastPreview } from './hooks';

const CHANNELS: { value: NotificationChannel; label: string; icon: LucideIcon; tag: string; tagClass: string; soon?: boolean }[] = [
  { value: 'EMAIL', label: 'Email', icon: Mail, tag: 'Grátis', tagClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle, tag: 'Com custos', tagClass: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300' },
  { value: 'SMS', label: 'SMS', icon: Smartphone, tag: 'Brevemente', tagClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', soon: true },
];

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  active: 'Membros activos',
  all: 'Todos os membros',
  due_7_days: MEMBER_FILTER_LABELS.due_7_days,
  due_today: MEMBER_FILTER_LABELS.due_today,
  overdue: MEMBER_FILTER_LABELS.overdue,
  inactive: MEMBER_FILTER_LABELS.inactive,
};

const VARIABLES = ['name', 'full_name', 'plan', 'due_date', 'amount', 'gym_name'];

/** Envio de mensagens a vários membros de uma vez, com pré-visualização dos destinatários. */
export function BroadcastDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [channel, setChannel] = useState<NotificationChannel>('EMAIL');
  const [audience, setAudience] = useState<BroadcastAudience>('active');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const preview = useBroadcastPreview({ channel, audience }, open && channel !== 'SMS');
  const send = useBroadcast();

  useEffect(() => {
    if (open) {
      setChannel('EMAIL');
      setAudience('active');
      setSubject('');
      setMessage('');
    }
  }, [open]);

  const p = preview.data;
  const recipients = p?.recipients ?? 0;
  const emailReady = channel !== 'EMAIL' || (subject.trim().length > 0 && message.trim().length >= 3);
  const canSend = channel !== 'SMS' && recipients > 0 && emailReady && !preview.isFetching;

  const submit = async () => {
    try {
      const r = await send.mutateAsync({ channel, audience, subject: subject || null, message: message || null });
      const parts = [`${r.sent} enviada(s)`, r.failed && `${r.failed} falhada(s)`, r.skipped && `${r.skipped} ignorada(s)`].filter(Boolean).join(', ');
      if (r.failed) toast.warning(parts);
      else toast.success(`Mensagens enviadas: ${parts}`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Enviar mensagem a vários membros"
      description="Escolha o canal e o público. Só recebem os membros com notificações activas."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={send.isPending} disabled={!canSend}>
            {recipients > 0 ? `Enviar a ${recipients} membro${recipients === 1 ? '' : 's'}` : 'Enviar'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Canal</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {CHANNELS.map((c) => {
              const on = channel === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={c.soon}
                  onClick={() => setChannel(c.value)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                    on ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:border-brand-300 dark:bg-brand-300/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600',
                    c.soon && 'cursor-not-allowed opacity-60 hover:border-slate-200 dark:hover:border-slate-800',
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs dark:bg-slate-800">
                    <c.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{c.label}</span>
                    <span className={cn('mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold', c.tagClass)}>{c.tag}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Select
          label="Público"
          value={audience}
          onChange={(e) => setAudience(e.target.value as BroadcastAudience)}
          options={BROADCAST_AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }))}
        />

        {channel === 'EMAIL' && (
          <div className="space-y-3">
            <Input label="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: Novo horário de fim-de-semana" maxLength={150} />
            <Textarea
              label="Mensagem"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={'Olá {{name}},\n\nA partir de sábado o ginásio abre às 7h.\n\n{{gym_name}}'}
              maxLength={4000}
            />
            <p className="text-xs text-slate-500">
              Personalize com: {VARIABLES.map((v) => <code key={v} className="mr-1 rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">{`{{${v}}}`}</code>)}
            </p>
          </div>
        )}

        {channel === 'WHATSAPP' && (
          <Note icon={Info}>
            O WhatsApp só permite iniciar conversas com <strong>templates aprovados</strong>. Cada membro recebe o adequado ao seu estado: lembrete de vencimento (em breve ou hoje) ou aviso de pagamento em atraso. Membros sem subscrição ficam de fora. Cada mensagem tem custo no fornecedor.
          </Note>
        )}

        {channel === 'SMS' && <Note icon={Info}>O envio por SMS estará disponível brevemente.</Note>}

        {channel !== 'SMS' && (
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            {preview.isLoading || !p ? (
              preview.error ? (
                <p className="text-sm text-red-600">{errorMessage(preview.error)}</p>
              ) : (
                <Skeleton className="h-12" />
              )
            ) : (
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4 text-slate-500" />
                  {recipients} de {p.total} membro{p.total === 1 ? '' : 's'} vão receber
                </p>
                {p.sample.length > 0 && (
                  <p className="text-slate-600 dark:text-slate-300">
                    {p.sample.join(', ')}
                    {recipients > p.sample.length && ` e mais ${recipients - p.sample.length}`}
                  </p>
                )}
                <ExcludedLine excluded={p.excluded} channel={channel} />
                {!p.provider.real && (
                  <Note icon={AlertTriangle} tone="amber">
                    {channel === 'EMAIL' ? 'O email' : 'O WhatsApp'} está em modo de teste: as mensagens ficam registadas mas não são entregues.
                  </Note>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ExcludedLine({ excluded, channel }: { excluded: { noContact: number; notificationsOff: number; noSubscription: number }; channel: NotificationChannel }) {
  const parts = [
    excluded.notificationsOff && `${excluded.notificationsOff} com notificações desactivadas`,
    excluded.noContact && `${excluded.noContact} sem ${channel === 'EMAIL' ? 'email' : 'telefone'}`,
    excluded.noSubscription && `${excluded.noSubscription} sem subscrição`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="text-xs text-slate-500">Ficam de fora: {parts.join(' · ')}. Active as notificações no perfil de cada membro.</p>;
}

function Note({ icon: Icon, tone = 'slate', children }: { icon: LucideIcon; tone?: 'slate' | 'amber'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-xl p-3 text-xs leading-relaxed',
        tone === 'amber' ? 'bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
