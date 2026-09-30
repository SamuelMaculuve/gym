import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { forgotPasswordSchema, passwordSchema, type ForgotPasswordInput } from '@gymflow/shared';
import { Button, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const submit = form.handleSubmit(async (v) => {
    try {
      await api.auth.forgotPassword(v);
      setSent(true);
    } catch (e) {
      form.setError('email', { message: errorMessage(e) });
    }
  });
  return (
    <AuthLayout title="Recuperar conta" description="Enviaremos um link para redefinir a palavra-passe.">
      {sent ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> Se o email estiver registado, receberá as instruções em instantes.
          </div>
          <Link to="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">Voltar ao login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" autoFocus {...form.register('email')} error={form.formState.errors.email?.message} />
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>Enviar link</Button>
          <Link to="/login" className="block text-center text-sm text-slate-500 hover:underline">Voltar ao login</Link>
        </form>
      )}
    </AuthLayout>
  );
}

const resetForm = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'As palavras-passe não coincidem', path: ['confirm'] });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetForm>>({ resolver: zodResolver(resetForm), defaultValues: { password: '', confirm: '' } });
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.auth.resetPassword({ token, password: v.password });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <AuthLayout title="Nova palavra-passe">
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Palavra-passe redefinida com sucesso.</p>
          <Link to="/login"><Button className="w-full">Entrar</Button></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {(error || !token) && <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error ?? 'Link inválido.'}</div>}
          <Input label="Nova palavra-passe" type="password" autoComplete="new-password" {...form.register('password')} error={form.formState.errors.password?.message} />
          <Input label="Confirmar" type="password" autoComplete="new-password" {...form.register('confirm')} error={form.formState.errors.confirm?.message} />
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting} disabled={!token}>Guardar</Button>
        </form>
      )}
    </AuthLayout>
  );
}
