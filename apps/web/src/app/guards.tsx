import { Dumbbell, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import type { Permission } from '@gymflow/shared';
import { EmptyState } from '../components/ui';
import { useAuth } from '../lib/auth';

export function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-brand-600 text-white">
        <Dumbbell className="h-6 w-6" />
      </span>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <EmptyState
        icon={<Lock className="h-6 w-6" />}
        title="Acesso restrito"
        description="O seu perfil não tem permissão para aceder a esta página."
        action={<Link to="/" className="text-sm font-medium text-brand-700 hover:underline">Voltar ao início</Link>}
      />
    );
  }
  return <>{children}</>;
}

export function NotFoundPage() {
  return (
    <EmptyState
      title="Página não encontrada"
      description="O endereço que procura não existe."
      action={<Link to="/" className="text-sm font-medium text-brand-700 hover:underline">Voltar ao início</Link>}
    />
  );
}
