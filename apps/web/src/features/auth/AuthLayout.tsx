import { Dumbbell } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.25),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500">
              <Dumbbell className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold">GymFlow</span>
          </div>
          <div className="max-w-md">
            <p className="text-3xl leading-tight font-semibold">Membros, pagamentos e presenças num só lugar.</p>
            <p className="mt-4 text-slate-300">Lembretes automáticos por WhatsApp e email, check-in por QR Code e relatórios financeiros em tempo real.</p>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} GymFlow</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-brand-300 dark:bg-slate-900">
              <Dumbbell className="h-5 w-5" />
            </span>
            <span className="font-semibold">GymFlow</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
