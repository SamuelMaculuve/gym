import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck, LogOut, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { addDays, ATTENDANCE_METHOD_LABELS, formatDate, manualAttendanceSchema, type AttendanceDTO, type MemberListItem } from '@gymflow/shared';
import { MemberPicker } from '../../components/MemberPicker';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, DataTable, DatePicker, EmptyState, Input, Modal, Pagination, SearchInput, SubscriptionBadge, Textarea, type Column } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { applyServerErrors, errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { CheckInPanel } from './CheckInPanel';
import { useAttendance, useCheckOut, useManualAttendance } from './hooks';

export function AttendancePage() {
  const f = useFormat();
  const { can } = useAuth();
  const [date, setDate] = useState(f.today);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [manual, setManual] = useState(false);
  const { data, isLoading, isFetching } = useAttendance({ from: date, to: date, q: q || undefined, page, pageSize: 25 });
  const checkOut = useCheckOut();

  const columns: Column<AttendanceDTO>[] = [
    {
      key: 'member',
      header: 'Membro',
      cell: (a) => (
        <div className="flex items-center gap-3">
          <Avatar name={a.member?.fullName ?? '?'} size="sm" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{a.member?.fullName}</p>
            <p className="text-xs text-slate-500">{a.member?.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'in', header: 'Entrada', cell: (a) => <span className="tabular">{f.time(a.checkInAt)}</span> },
    { key: 'out', header: 'Saída', cell: (a) => <span className="tabular">{f.time(a.checkOutAt)}</span> },
    { key: 'method', header: 'Método', hideBelow: 'md', cell: (a) => ATTENDANCE_METHOD_LABELS[a.method] },
    {
      key: 'status',
      header: 'Subscrição',
      hideBelow: 'lg',
      cell: (a) => (
        <div className="flex gap-1.5">
          <SubscriptionBadge status={a.subscriptionStatus} />
          {a.overridden && <Badge tone="orange">Autorizada</Badge>}
        </div>
      ),
    },
    {
      key: 'x',
      header: <span className="sr-only">Acções</span>,
      align: 'right',
      cell: (a) =>
        !a.checkOutAt &&
        can('attendance:write') && (
          <Button size="sm" variant="ghost" icon={<LogOut className="h-4 w-4" />} loading={checkOut.isPending && checkOut.variables === a.id} onClick={() => checkOut.mutateAsync(a.id).then(() => toast.success('Saída registada')).catch((e) => toast.error(errorMessage(e)))}>
            Saída
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Presenças"
        description="Check-in por QR Code, código de membro, telefone ou nome."
        actions={can('attendance:write') && <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setManual(true)}>Registo manual</Button>}
      />
      {can('attendance:write') && (
        <Card className="mb-6">
          <CardHeader title="Check-in rápido" description="Scan QR → verificar subscrição → registar presença" />
          <CardBody>
            <CheckInPanel />
          </CardBody>
        </Card>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDate(addDays(date, -1)); setPage(1); }} aria-label="Dia anterior">‹</Button>
            <DatePicker aria-label="Data" value={date} max={f.today} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
            <Button variant="outline" size="sm" disabled={date >= f.today} onClick={() => { setDate(addDays(date, 1)); setPage(1); }} aria-label="Dia seguinte">›</Button>
          </div>
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Pesquisar membro" className="flex-1" />
          <span className="text-sm text-slate-500">{data ? `${data.total} presença(s) em ${formatDate(date)}` : ''}</span>
        </div>
        <DataTable
          columns={columns}
          data={data?.items}
          loading={isLoading || isFetching}
          rowKey={(a) => a.id}
          empty={<EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Sem presenças" description={`Nenhuma entrada registada em ${formatDate(date)}.`} />}
          mobileCard={(a) => (
            <div className="flex items-center gap-3">
              <Avatar name={a.member?.fullName ?? '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.member?.fullName}</p>
                <p className="text-xs text-slate-500">
                  {f.time(a.checkInAt)} → {f.time(a.checkOutAt)} · {ATTENDANCE_METHOD_LABELS[a.method]}
                </p>
              </div>
              {!a.checkOutAt && can('attendance:write') && (
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); checkOut.mutate(a.id); }}>Saída</Button>
              )}
            </div>
          )}
          footer={data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onChange={setPage} />}
        />
      </Card>
      <ManualAttendanceModal open={manual} onClose={() => setManual(false)} />
    </>
  );
}

type ManualIn = z.input<typeof manualAttendanceSchema>;

function ManualAttendanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const f = useFormat();
  const create = useManualAttendance();
  const [member, setMember] = useState<MemberListItem | null>(null);
  const form = useForm<ManualIn>({ resolver: zodResolver(manualAttendanceSchema), defaultValues: { memberId: '', date: f.today, checkInTime: '', checkOutTime: '', notes: '' } });
  useEffect(() => {
    if (open) {
      form.reset({ memberId: '', date: f.today, checkInTime: '', checkOutTime: '', notes: '' });
      setMember(null);
    }
  }, [open, form, f.today]);
  const submit = form.handleSubmit(async (v) => {
    try {
      await create.mutateAsync(v);
      toast.success('Presença registada');
      onClose();
    } catch (e) {
      if (!applyServerErrors(e, form.setError)) toast.error(errorMessage(e));
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registo manual de presença"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={create.isPending}>Registar</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <MemberPicker value={member} onChange={(m) => { setMember(m); form.setValue('memberId', m?.id ?? ''); }} error={form.formState.errors.memberId?.message} />
        <div className="grid grid-cols-3 gap-3">
          <DatePicker label="Data" max={f.today} {...form.register('date')} error={form.formState.errors.date?.message} />
          <Input label="Entrada" type="time" {...form.register('checkInTime')} error={form.formState.errors.checkInTime?.message} />
          <Input label="Saída" type="time" {...form.register('checkOutTime')} error={form.formState.errors.checkOutTime?.message} />
        </div>
        <Textarea label="Observação" rows={2} {...form.register('notes')} />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
