import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  addDays,
  formatDate,
  MEMBER_NOTIFICATION_TYPES,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_TYPE_LABELS,
  renderTemplate,
  TEMPLATE_VARIABLES,
  unknownTemplateVariables,
  type NotificationType,
  type TemplateDTO,
} from '@gymflow/shared';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Button, Card, CardBody, ConfirmDialog, Input, LoadingState, Switch, Tabs, Textarea } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useResetTemplate, useTemplates, useUpdateTemplate } from './hooks';

export function TemplatesPage() {
  const { data, isLoading } = useTemplates();
  const [type, setType] = useState<NotificationType>('DUE_TODAY');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const forType = useMemo(() => (data ?? []).filter((t) => t.type === type), [data, type]);
  const current = forType.find((t) => t.id === templateId) ?? forType[0];

  return (
    <>
      <Link to="/notifications" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Notificações
      </Link>
      <PageHeader title="Templates de mensagens" description="As variáveis são substituídas automaticamente antes do envio." />
      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit p-2">
            {MEMBER_NOTIFICATION_TYPES.map((t) => {
              const inactive = (data ?? []).filter((x) => x.type === t && !x.active).length;
              return (
                <button
                  key={t}
                  onClick={() => { setType(t); setTemplateId(null); }}
                  className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm', type === t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}
                >
                  {NOTIFICATION_TYPE_LABELS[t]}
                  {inactive > 0 && <span className="text-xs opacity-60">{inactive} off</span>}
                </button>
              );
            })}
          </Card>
          <div className="space-y-3">
            <Tabs value={current?.id ?? ''} onChange={setTemplateId} items={forType.map((t) => ({ value: t.id, label: NOTIFICATION_CHANNEL_LABELS[t.channel] }))} />
            {current && <TemplateEditor key={current.id} template={current} />}
          </div>
        </div>
      )}
    </>
  );
}

function TemplateEditor({ template }: { template: TemplateDTO }) {
  const f = useFormat();
  const { gym, can } = useAuth();
  const editable = can('notifications:write');
  const update = useUpdateTemplate();
  const reset = useResetTemplate();
  const [subject, setSubject] = useState(template.subject ?? '');
  const [body, setBody] = useState(template.body);
  const [active, setActive] = useState(template.active);
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSubject(template.subject ?? '');
    setBody(template.body);
    setActive(template.active);
  }, [template]);

  const sample = {
    name: 'Ana',
    plan: 'Mensal',
    amount: f.money(150000),
    due_date: formatDate(addDays(f.today, 3)),
    gym_name: gym?.name ?? 'Ginásio',
    payment_link: `${window.location.origin}/pay/exemplo`,
    member_code: 'GYM-000001',
    gym_phone: '+258 84 100 0100',
  };
  const unknown = unknownTemplateVariables(`${subject} ${body}`);
  const dirty = body !== template.body || subject !== (template.subject ?? '') || active !== template.active;

  const insert = (key: string) => {
    const el = ref.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    try {
      await update.mutateAsync({ id: template.id, input: { subject: template.channel === 'EMAIL' ? subject : null, body, active } });
      toast.success('Template guardado');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardBody className="space-y-4">
          <Switch checked={active} onChange={setActive} disabled={!editable} label="Template activo" description="Se desactivado, esta mensagem não é enviada neste canal." />
          {template.channel === 'EMAIL' && <Input label="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} />}
          <Textarea ref={ref} label="Mensagem" rows={10} value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable} error={unknown.length ? `Variáveis desconhecidas: ${unknown.join(', ')}` : undefined} />
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Inserir variável</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button key={v.key} type="button" disabled={!editable} title={v.description} onClick={() => insert(v.key)} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300">
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>
          {editable && (
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirmReset(true)}>Repor padrão</Button>
              <Button onClick={save} disabled={!dirty || unknown.length > 0} loading={update.isPending}>Guardar</Button>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-medium">Pré-visualização</p>
            <Badge tone="blue">{NOTIFICATION_CHANNEL_LABELS[template.channel]}</Badge>
          </div>
          <div className={cn('rounded-2xl p-4 text-sm whitespace-pre-line', template.channel === 'WHATSAPP' ? 'ml-auto max-w-sm rounded-tr-sm bg-[#dcf8c6] text-slate-900' : 'border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200')}>
            {template.channel === 'EMAIL' && <p className="mb-3 border-b border-slate-100 pb-2 font-semibold dark:border-slate-800">{renderTemplate(subject, sample)}</p>}
            {renderTemplate(body, sample)}
          </div>
          <p className="mt-3 text-xs text-slate-500">Exemplo com dados fictícios. Actualizado em {f.dateTime(template.updatedAt)}.</p>
        </CardBody>
      </Card>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        tone="primary"
        title="Repor o template padrão?"
        description="O texto actual será substituído pela versão original."
        confirmLabel="Repor"
        loading={reset.isPending}
        onConfirm={async () => {
          await reset.mutateAsync(template.id);
          setConfirmReset(false);
          toast.success('Template reposto');
        }}
      />
    </div>
  );
}
