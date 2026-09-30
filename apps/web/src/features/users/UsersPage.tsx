import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Pencil, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { passwordSchema, ROLE_LABELS, ROLE_PERMISSIONS, ROLES, userCreateSchema, type Role, type UserDTO } from '@gymflow/shared';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, DataTable, Input, Modal, Select, Switch, type Column } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { applyServerErrors, errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useResetUserPassword, useSaveUser, useUsers } from './hooks';

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Acesso total, incluindo configurações, planos e utilizadores.',
  MANAGER: 'Gere membros, subscrições, pagamentos, presenças e relatórios.',
  RECEPTIONIST: 'Cadastra membros, regista pagamentos e presenças.',
  ACCOUNTANT: 'Consulta pagamentos, receitas e relatórios.',
};

export function UsersPage() {
  const f = useFormat();
  const { user: me } = useAuth();
  const { data, isLoading } = useUsers();
  const [editing, setEditing] = useState<UserDTO | 'new' | null>(null);
  const [resetting, setResetting] = useState<UserDTO | null>(null);

  const columns: Column<UserDTO>[] = [
    {
      key: 'name',
      header: 'Utilizador',
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{u.name} {u.id === me?.id && <span className="text-xs text-slate-400">(eu)</span>}</p>
            <p className="text-xs text-slate-500">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Perfil', cell: (u) => <Badge tone={u.role === 'ADMIN' ? 'violet' : 'gray'}>{ROLE_LABELS[u.role]}</Badge> },
    { key: 'status', header: 'Estado', cell: (u) => <Badge tone={u.active ? 'green' : 'gray'} dot>{u.active ? 'Activo' : 'Inactivo'}</Badge> },
    { key: 'last', header: 'Último acesso', hideBelow: 'md', cell: (u) => <span className="text-xs">{f.dateTime(u.lastLoginAt)}</span> },
    {
      key: 'x',
      header: <span className="sr-only">Acções</span>,
      align: 'right',
      cell: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" icon={<KeyRound className="h-4 w-4" />} onClick={() => setResetting(u)} aria-label="Redefinir palavra-passe" />
          <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(u)} aria-label="Editar" />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Utilizadores" description="Funcionários com acesso ao sistema e respectivos perfis." actions={<Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setEditing('new')}>Novo utilizador</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <DataTable columns={columns} data={data} loading={isLoading} rowKey={(u) => u.id} />
        </Card>
        <Card className="h-fit">
          <CardHeader title="Perfis e permissões" />
          <CardBody className="space-y-3">
            {ROLES.map((r) => (
              <div key={r}>
                <p className="text-sm font-medium">{ROLE_LABELS[r]} <span className="text-xs font-normal text-slate-400">· {ROLE_PERMISSIONS[r].length} permissões</span></p>
                <p className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[r]}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      <UserModal user={editing} onClose={() => setEditing(null)} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
    </>
  );
}

const editSchema = z.object({ name: z.string().trim().min(2, 'Indique o nome'), role: z.enum(ROLES), active: z.boolean() });

function UserModal({ user, onClose }: { user: UserDTO | 'new' | null; onClose: () => void }) {
  const save = useSaveUser();
  const isNew = user === 'new';
  const createForm = useForm<z.infer<typeof userCreateSchema>>({ resolver: zodResolver(userCreateSchema) });
  const editForm = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) });
  const active = useWatch({ control: editForm.control, name: 'active' });

  useEffect(() => {
    if (user === 'new') createForm.reset({ name: '', email: '', role: 'RECEPTIONIST', password: '' });
    else if (user) editForm.reset({ name: user.name, role: user.role, active: user.active });
  }, [user, createForm, editForm]);

  const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const submit = isNew
    ? createForm.handleSubmit(async (v) => {
        try {
          await save.mutateAsync({ create: v });
          toast.success('Utilizador criado');
          onClose();
        } catch (e) {
          if (!applyServerErrors(e, createForm.setError)) toast.error(errorMessage(e));
        }
      })
    : editForm.handleSubmit(async (v) => {
        try {
          await save.mutateAsync({ id: (user as UserDTO).id, update: v });
          toast.success('Utilizador actualizado');
          onClose();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      });

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={isNew ? 'Novo utilizador' : 'Editar utilizador'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={save.isPending}>Guardar</Button>
        </>
      }
    >
      {isNew ? (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nome" {...createForm.register('name')} error={createForm.formState.errors.name?.message} />
          <Input label="Email" type="email" {...createForm.register('email')} error={createForm.formState.errors.email?.message} />
          <Select label="Perfil" options={roleOptions} {...createForm.register('role')} />
          <Input label="Palavra-passe inicial" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres, com letras e números." {...createForm.register('password')} error={createForm.formState.errors.password?.message} />
          <button type="submit" className="hidden" />
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nome" {...editForm.register('name')} error={editForm.formState.errors.name?.message} />
          <Select label="Perfil" options={roleOptions} {...editForm.register('role')} />
          <Switch checked={Boolean(active)} onChange={(v) => editForm.setValue('active', v)} label="Conta activa" description="Contas inactivas não conseguem iniciar sessão." />
          <button type="submit" className="hidden" />
        </form>
      )}
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserDTO | null; onClose: () => void }) {
  const reset = useResetUserPassword();
  const form = useForm<{ password: string }>({ resolver: zodResolver(z.object({ password: passwordSchema })) });
  useEffect(() => {
    if (user) form.reset({ password: '' });
  }, [user, form]);
  const submit = form.handleSubmit(async ({ password }) => {
    try {
      await reset.mutateAsync({ id: user!.id, password });
      toast.success('Palavra-passe redefinida. As sessões activas foram terminadas.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });
  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title="Redefinir palavra-passe"
      description={user?.email}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={reset.isPending}>Redefinir</Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Input label="Nova palavra-passe" type="password" autoComplete="new-password" {...form.register('password')} error={form.formState.errors.password?.message} />
      </form>
    </Modal>
  );
}
