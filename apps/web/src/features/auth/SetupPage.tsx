import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import type { z } from 'zod';
import { setupSchema, SUPPORTED_CURRENCIES } from '@gymflow/shared';
import { Button, Input, LoadingState, Select, Switch } from '../../components/ui';
import { api, tokenStorage } from '../../lib/api';
import { applyServerErrors, errorMessage } from '../../lib/errors';
import { qk } from '../../lib/query-keys';
import { AuthLayout } from './AuthLayout';

type SetupIn = z.input<typeof setupSchema>;
type SetupOut = z.output<typeof setupSchema>;

/** Primeira utilização: cria o ginásio e a conta de administrador numa base de dados vazia. */
export function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const status = useQuery({ queryKey: ['setup-status'], queryFn: api.setup.status, retry: false });
  const form = useForm<SetupIn, unknown, SetupOut>({
    resolver: zodResolver(setupSchema),
    defaultValues: { gymName: '', adminName: '', email: '', password: '', currency: 'MZN', timezone: 'Africa/Maputo', createDefaultPlans: true, includeDemoData: false, createDemoUsers: false, setupToken: '' },
  });

  if (status.isLoading) return <LoadingState />;
  if (status.data && !status.data.needsSetup) return <Navigate to="/login" replace />;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const session = await api.setup.run(values);
      await tokenStorage.set(session.token);
      await queryClient.fetchQuery({ queryKey: qk.me, queryFn: api.auth.me });
      navigate('/', { replace: true });
    } catch (e) {
      if (!applyServerErrors(e, form.setError)) setError(errorMessage(e));
    }
  });
  const e = form.formState.errors;

  return (
    <AuthLayout title="Configurar o ginásio" description="Primeira utilização: crie o ginásio e a conta de administrador.">
      {status.data?.blocked ? (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Por segurança, defina a variável <code className="font-mono">SETUP_TOKEN</code> nas configurações do site na Netlify
            (Site configuration → Environment variables) e faça novo deploy. Depois volte a esta página.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
          {status.data?.tokenRequired && (
            <Input label="Código de configuração" hint="O valor da variável SETUP_TOKEN." type="password" autoComplete="off" {...form.register('setupToken')} error={e.setupToken?.message} />
          )}
          <Input label="Nome do ginásio" autoFocus {...form.register('gymName')} error={e.gymName?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Moeda" options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))} {...form.register('currency')} />
            <Select label="Fuso horário" options={['Africa/Maputo', 'Africa/Johannesburg', 'Africa/Luanda', 'Europe/Lisbon', 'UTC'].map((t) => ({ value: t, label: t }))} {...form.register('timezone')} />
          </div>
          <Input label="O seu nome" {...form.register('adminName')} error={e.adminName?.message} />
          <Input label="Email" type="email" autoComplete="email" {...form.register('email')} error={e.email?.message} />
          <Input label="Palavra-passe" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres, com letras e números." {...form.register('password')} error={e.password?.message} />
          <Controller control={form.control} name="createDefaultPlans" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Criar planos padrão" description="Mensal, Trimestral, Semestral e Anual (editáveis depois)." />} />
          <Controller control={form.control} name="includeDemoData" render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Incluir dados de demonstração" description="20 membros fictícios, pagamentos e presenças para explorar o sistema." />} />
          <Controller
            control={form.control}
            name="createDemoUsers"
            render={({ field }) => (
              <Switch
                checked={Boolean(field.value)}
                onChange={field.onChange}
                label="Criar contas de demonstração"
                description="gestor@, recepcao@ e contabilidade@gymflow.co.mz com as palavras-passe de demonstração. Altere-as ou desactive as contas depois dos testes."
              />
            )}
          />
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            Criar ginásio
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
