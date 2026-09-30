import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import type { AuditLogDTO } from '@gymflow/shared';
import { ROLE_LABELS } from '@gymflow/shared';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Card, DataTable, EmptyState, Modal, Pagination, SearchInput, Select, type Column } from '../../components/ui';
import { useFormat } from '../../lib/format';
import { useAudit } from './hooks';

const ENTITIES = [
  { value: 'Member', label: 'Membros' },
  { value: 'Payment', label: 'Pagamentos' },
  { value: 'Subscription', label: 'Subscrições' },
  { value: 'Plan', label: 'Planos' },
  { value: 'Attendance', label: 'Presenças' },
  { value: 'User', label: 'Utilizadores' },
  { value: 'Gym', label: 'Configurações' },
  { value: 'NotificationTemplate', label: 'Templates' },
  { value: 'Notification', label: 'Notificações' },
];

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <p className="text-xs text-slate-400">—</p>;
  return <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">{JSON.stringify(value, null, 2)}</pre>;
}

export function AuditPage() {
  const f = useFormat();
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogDTO | null>(null);
  const { data, isLoading, isFetching } = useAudit({ q: q || undefined, entity: entity || undefined, page, pageSize: 30 });

  const columns: Column<AuditLogDTO>[] = [
    { key: 'date', header: 'Data/hora', cell: (a) => <span className="text-xs whitespace-nowrap tabular">{f.dateTime(a.createdAt)}</span> },
    { key: 'user', header: 'Utilizador', hideBelow: 'md', cell: (a) => (a.user ? <span>{a.user.name} <span className="text-xs text-slate-400">· {ROLE_LABELS[a.user.role]}</span></span> : 'Sistema') },
    { key: 'entity', header: 'Entidade', hideBelow: 'sm', cell: (a) => <Badge>{ENTITIES.find((e) => e.value === a.entity)?.label ?? a.entity}</Badge> },
    { key: 'summary', header: 'Operação', cell: (a) => <span className="text-slate-800 dark:text-slate-200">{a.summary}</span> },
  ];

  return (
    <>
      <PageHeader title="Auditoria" description="Registo de todas as operações importantes: quem, o quê, quando, dados anteriores e novos." />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row dark:border-slate-800">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Pesquisar operação" className="flex-1" />
          <Select aria-label="Entidade" containerClassName="sm:w-52" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} placeholder="Todas as entidades" options={ENTITIES} />
        </div>
        <DataTable
          columns={columns}
          data={data?.items}
          loading={isLoading || isFetching}
          rowKey={(a) => a.id}
          onRowClick={setSelected}
          empty={<EmptyState icon={<ScrollText className="h-6 w-6" />} title="Sem registos" />}
          mobileCard={(a) => (
            <div>
              <p className="text-sm">{a.summary}</p>
              <p className="mt-0.5 text-xs text-slate-500">{f.dateTime(a.createdAt)}</p>
            </div>
          )}
          footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onChange={setPage} />}
        />
      </Card>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Detalhe da operação" size="lg">
        {selected && (
          <div className="space-y-4 pb-2 text-sm">
            <p className="font-medium">{selected.summary}</p>
            <dl className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <dt>Acção</dt><dd className="font-mono text-slate-800 dark:text-slate-200">{selected.action}</dd>
              <dt>Entidade</dt><dd className="font-mono text-slate-800 dark:text-slate-200">{selected.entity} {selected.entityId}</dd>
              <dt>Data/hora</dt><dd className="text-slate-800 dark:text-slate-200">{f.dateTime(selected.createdAt)}</dd>
              <dt>IP</dt><dd className="text-slate-800 dark:text-slate-200">{selected.ip ?? '—'}</dd>
            </dl>
            <div className="grid gap-3 md:grid-cols-2">
              <div><p className="mb-1 text-xs font-medium text-slate-500">Dados anteriores</p><Json value={selected.before} /></div>
              <div><p className="mb-1 text-xs font-medium text-slate-500">Dados novos</p><Json value={selected.after} /></div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
