import { zodResolver } from '@hookform/resolvers/zod';
import { ListChecks, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { fromCents, planSchema, type PlanDTO } from '@gymflow/shared';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Button, Card, EmptyState, Input, Modal, Skeleton, Switch, Textarea } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { applyServerErrors, errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { usePlans, useSavePlan } from './hooks';

export function PlansPage() {
  const f = useFormat();
  const { can } = useAuth();
  const { data, isLoading } = usePlans();
  const [editing, setEditing] = useState<PlanDTO | 'new' | null>(null);

  return (
    <>
      <PageHeader
        title="Planos"
        description="Preços e durações. Alterações de preço aplicam-se apenas a novos períodos."
        actions={can('plans:write') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Novo plano</Button>}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Sem planos" description="Crie o primeiro plano de subscrição." action={can('plans:write') && <Button onClick={() => setEditing('new')}>Novo plano</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((p) => (
            <Card key={p.id} className={cn('flex flex-col p-5', !p.active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-slate-500">{p.durationLabel ?? `${p.durationDays} dias`} · {p.durationDays} dias</p>
                </div>
                {!p.active && <Badge>Inactivo</Badge>}
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight">{f.money(p.priceCents)}</p>
              <p className="mt-1 text-xs text-slate-500">≈ {f.money(Math.round((p.priceCents / p.durationDays) * 30))} / 30 dias</p>
              {p.description && <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{p.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-xs text-slate-500">{p.activeSubscriptions} membro(s)</span>
                {can('plans:write') && (
                  <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(p)}>
                    Editar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <PlanModal plan={editing} onClose={() => setEditing(null)} />
    </>
  );
}

type PlanIn = z.input<typeof planSchema>;
type PlanOut = z.output<typeof planSchema>;

function PlanModal({ plan, onClose }: { plan: PlanDTO | 'new' | null; onClose: () => void }) {
  const save = useSavePlan();
  const form = useForm<PlanIn, unknown, PlanOut>({ resolver: zodResolver(planSchema) });
  const active = useWatch({ control: form.control, name: 'active' });

  useEffect(() => {
    if (!plan) return;
    form.reset(
      plan === 'new'
        ? { name: '', description: '', price: 0, durationDays: 30, durationLabel: '', active: true }
        : { name: plan.name, description: plan.description ?? '', price: fromCents(plan.priceCents), durationDays: plan.durationDays, durationLabel: plan.durationLabel ?? '', active: plan.active },
    );
  }, [plan, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: plan && plan !== 'new' ? plan.id : undefined, input: values });
      toast.success('Plano guardado');
      onClose();
    } catch (e) {
      if (!applyServerErrors(e, form.setError)) toast.error(errorMessage(e));
    }
  });

  const e = form.formState.errors;
  return (
    <Modal
      open={Boolean(plan)}
      onClose={onClose}
      title={plan === 'new' ? 'Novo plano' : 'Editar plano'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={save.isPending}>Guardar</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nome" required {...form.register('name')} error={e.name?.message} />
        <Textarea label="Descrição" rows={2} {...form.register('description')} error={e.description?.message} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Preço" type="number" step="0.01" required {...form.register('price', { valueAsNumber: true })} error={e.price?.message} />
          <Input label="Número de dias" type="number" required {...form.register('durationDays', { valueAsNumber: true })} error={e.durationDays?.message} />
          <Input label="Duração (texto)" placeholder="ex.: 1 mês" {...form.register('durationLabel')} />
        </div>
        <Switch checked={Boolean(active)} onChange={(v) => form.setValue('active', v)} label="Plano activo" description="Planos inactivos não aparecem em novas inscrições ou pagamentos." />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
