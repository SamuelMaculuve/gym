import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { loginSchema, type LoginInput } from '@gymflow/shared';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';

const DEMO = [
  { label: 'Administrador', email: 'admin@gymflow.co.mz', password: 'Admin@2026' },
  { label: 'Recepção', email: 'recepcao@gymflow.co.mz', password: 'Recepcao@2026' },
  { label: 'Contabilidade', email: 'contabilidade@gymflow.co.mz', password: 'Conta@2026' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  if (user) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthLayout title="Entrar" description="Aceda à gestão do seu ginásio.">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
        <Input label="Email" type="email" autoComplete="email" autoFocus {...form.register('email')} error={form.formState.errors.email?.message} />
        <Input label="Palavra-passe" type="password" autoComplete="current-password" {...form.register('password')} error={form.formState.errors.password?.message} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
            Esqueceu a palavra-passe?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Entrar
        </Button>
      </form>
      {import.meta.env.DEV && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
          <p className="mb-2 text-xs font-medium text-slate-500">Contas de demonstração</p>
          <div className="flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  form.setValue('email', d.email);
                  form.setValue('password', d.password);
                }}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
