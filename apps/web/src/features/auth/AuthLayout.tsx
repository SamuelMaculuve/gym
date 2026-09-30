import { Dumbbell } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative m-3 hidden overflow-hidden rounded-3xl bg-slate-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(212,245,138,0.22),transparent_50%),radial-gradient(circle_at_85%_85%,rgba(167,139,250,0.28),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-brand-300">
              <Dumbbell className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold">GymFlow</span>
          </div>
          <div className="max-w-md">
            <p className="text-4xl leading-tight font-medium tracking-tight">
              Membros, pagamentos e presenças num só{' '}
              <span className="relative inline-block">
                lugar.
                <svg className="absolute -bottom-2 left-0 h-3 w-full text-orange-400" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 8 C 30 2, 60 11, 118 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </p>
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
          <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
