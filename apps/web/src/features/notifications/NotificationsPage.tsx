import { Bell, FileText, Play, Send } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  describeReminderSchedule,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationDTO,
  type NotificationStatus,
  type NotificationType,
  type ReminderRunResult,
} from '@gymflow/shared';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Button, Card, CardBody, CardHeader, DataTable, EmptyState, Modal, NotificationStatusBadge, Pagination, SearchInput, Select, type Column } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useSettings } from '../settings/hooks';
import { useNotifications, useRunReminders } from './hooks';

export function NotificationsPage() {
  const f = useFormat();
  const { can } = useAuth();
  const settings = useSettings();
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState<NotificationChannel | ''>('');
  const [type, setType] = useState<NotificationType | ''>('');
  const [status, setStatus] = useState<NotificationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NotificationDTO | null>(null);
  const [preview, setPreview] = useState<ReminderRunResult | null>(null);
  const run = useRunReminders();

  const { data, isLoading, isFetching } = useNotifications({ q: q || undefined, channel: channel || undefined, type: type || undefined, status: status || undefined, page, pageSize: 25 });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  const doRun = async (dryRun: boolean) => {
    try {
      const r = await run.mutateAsync(dryRun);
      if (dryRun) setPreview(r);
      else {
        setPreview(null);
        toast.success(`Lembretes: ${r.sent} enviado(s)${r.failed ? `, ${r.failed} falhado(s)` : ''}`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: Column<NotificationDTO>[] = [
    { key: 'date', header: 'Data', cell: (n) => <span className="text-xs tabular">{f.dateTime(n.createdAt)}</span> },
    { key: 'member', header: 'Membro', cell: (n) => <span className="font-medium text-slate-900 dark:text-white">{n.member?.fullName ?? n.recipient}</span> },
    { key: 'channel', header: 'Canal', cell: (n) => <Badge tone="blue">{NOTIFICATION_CHANNEL_LABELS[n.channel]}</Badge> },
    { key: 'type', header: 'Tipo', hideBelow: 'md', cell: (n) => NOTIFICATION_TYPE_LABELS[n.type] },
    { key: 'msg', header: 'Mensagem', hideBelow: 'lg', cell: (n) => <span className="line-clamp-1 max-w-sm text-xs text-slate-500">{n.message}</span> },
    { key: 'status', header: 'Estado', cell: (n) => <NotificationStatusBadge status={n.status} /> },
  ];

  const providers = settings.data?.providers;
  return (
    <>
      <PageHeader
        title="Notificações"
        description="Histórico de lembretes e mensagens enviadas por WhatsApp, email e SMS."
        actions={
          <>
            <Link to="/settings/notifications">
              <Button variant="outline" icon={<FileText className="h-4 w-4" />}>Templates</Button>
            </Link>
            {can('notifications:write') && (
              <Button icon={<Play className="h-4 w-4" />} onClick={() => doRun(true)} loading={run.isPending && run.variables === true}>
                Executar lembretes
              </Button>
            )}
          </>
        }
      />

      {settings.data && (
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Calendário de lembretes" description={`Enviados automaticamente a partir das ${String(settings.data.notifications.sendHour).padStart(2, '0')}h (${settings.data.timezone})`} />
            <CardBody>
              <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {describeReminderSchedule(settings.data.notifications).map((l) => (
                  <li key={l} className="flex gap-2"><span className="text-brand-600">•</span>{l}</li>
                ))}
              </ul>
              {can('settings:write') && <Link to="/settings" className="mt-3 inline-block text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">Alterar configuração</Link>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Canais" description="Fornecedores configurados na API (credenciais nunca expostas no browser)" />
            <CardBody className="space-y-2">
              {NOTIFICATION_CHANNELS.map((c) => {
                const enabled = c === 'WHATSAPP' ? settings.data!.notifications.whatsappEnabled : c === 'EMAIL' ? settings.data!.notifications.emailEnabled : settings.data!.notifications.smsEnabled;
                const p = providers?.[c];
                return (
                  <div key={c} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{NOTIFICATION_CHANNEL_LABELS[c]}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={enabled ? 'green' : 'gray'}>{enabled ? 'Activo' : 'Desactivado'}</Badge>
                      <Badge tone={p?.provider === 'console' ? 'amber' : p?.configured ? 'green' : 'red'}>
                        {p?.provider === 'console' ? 'Modo de teste' : p?.configured ? p.provider : 'Não configurado'}
                      </Badge>
                    </span>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] dark:border-slate-800">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="Membro, destinatário ou texto" />
          <Select aria-label="Canal" value={channel} onChange={(e) => reset(setChannel)(e.target.value as NotificationChannel)} placeholder="Todos os canais" options={NOTIFICATION_CHANNELS.map((c) => ({ value: c, label: NOTIFICATION_CHANNEL_LABELS[c] }))} />
          <Select aria-label="Tipo" value={type} onChange={(e) => reset(setType)(e.target.value as NotificationType)} placeholder="Todos os tipos" options={NOTIFICATION_TYPES.map((t) => ({ value: t, label: NOTIFICATION_TYPE_LABELS[t] }))} />
          <Select aria-label="Estado" value={status} onChange={(e) => reset(setStatus)(e.target.value as NotificationStatus)} placeholder="Todos os estados" options={NOTIFICATION_STATUSES.map((s) => ({ value: s, label: NOTIFICATION_STATUS_LABELS[s] }))} />
        </div>
        <DataTable
          columns={columns}
          data={data?.items}
          loading={isLoading || isFetching}
          rowKey={(n) => n.id}
          onRowClick={setSelected}
          empty={<EmptyState icon={<Bell className="h-6 w-6" />} title="Sem notificações" />}
          mobileCard={(n) => (
            <div>
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{n.member?.fullName ?? n.recipient}</span>
                <Badge tone="blue">{NOTIFICATION_CHANNEL_LABELS[n.channel]}</Badge>
                <span className="ml-auto"><NotificationStatusBadge status={n.status} /></span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{f.dateTime(n.createdAt)} · {NOTIFICATION_TYPE_LABELS[n.type]}</p>
            </div>
          )}
          footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onChange={setPage} />}
        />
      </Card>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? NOTIFICATION_TYPE_LABELS[selected.type] : ''} description={selected ? `${NOTIFICATION_CHANNEL_LABELS[selected.channel]} → ${selected.recipient}` : ''}>
        {selected && (
          <div className="space-y-3 pb-2 text-sm">
            <div className="flex items-center gap-2">
              <NotificationStatusBadge status={selected.status} />
              <span className="text-xs text-slate-500">{f.dateTime(selected.sentAt ?? selected.createdAt)}</span>
            </div>
            {selected.subject && <p className="font-medium">{selected.subject}</p>}
            <p className="rounded-xl bg-slate-50 p-4 whitespace-pre-line dark:bg-slate-800/60">{selected.message}</p>
            {selected.error && <p className="text-red-600">Erro: {selected.error}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Pré-visualização dos lembretes"
        description="Nada foi enviado ainda. Lembretes já enviados neste período não são repetidos."
        footer={
          <>
            <Button variant="outline" onClick={() => setPreview(null)}>Fechar</Button>
            <Button icon={<Send className="h-4 w-4" />} disabled={!preview?.items.length} loading={run.isPending && run.variables === false} onClick={() => doRun(false)}>
              Enviar {preview?.items.length ?? 0} mensagem(ns)
            </Button>
          </>
        }
      >
        {preview && preview.items.length === 0 ? (
          <EmptyState title="Nada a enviar" description="Todos os lembretes aplicáveis já foram enviados." className="py-8" />
        ) : (
          <ul className="divide-y divide-slate-100 pb-2 dark:divide-slate-800">
            {preview?.items.map((i, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-medium">{i.memberName}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {NOTIFICATION_TYPE_LABELS[i.type]} <Badge tone="blue">{NOTIFICATION_CHANNEL_LABELS[i.channel]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
