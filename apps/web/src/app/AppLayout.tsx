import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck, CreditCard, Dumbbell, KeyRound, LogOut, Menu, Moon, Plus, Search, Sun, UserPlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { NavLink, Outlet, useLocation } from 'react-router';
import { toast } from 'sonner';
import { changePasswordSchema, ROLE_LABELS, type ChangePasswordInput } from '@gymflow/shared';
import { CommandPalette } from '../components/CommandPalette';
import { Avatar, Button, Input, Modal } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { applyServerErrors, errorMessage } from '../lib/errors';
import { useTheme } from '../lib/theme';
import { NAV_ITEMS } from './navigation';
import { QuickActionsProvider, useQuickActions } from './QuickActions';

function Brand() {
  const { gym } = useAuth();
  return (
    <div className="flex items-center gap-2.5">
      {gym?.logoUrl ? (
        <img src={gym.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Dumbbell className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{gym?.name ?? 'GymFlow'}</p>
        <p className="text-xs text-slate-500">GymFlow</p>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <nav className="space-y-0.5">
      {NAV_ITEMS.filter((i) => can(i.permission)).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
            )
          }
        >
          <item.icon className="h-[18px] w-[18px]" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (!user) return null;
  const item = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-slate-200 dark:hover:ring-slate-700" aria-label="Menu do utilizador">
        <Avatar name={user.name} size="sm" />
      </button>
      {open && (
        <div className="animate-fade-in absolute right-0 z-40 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-slate-500">
              {user.email} · {ROLE_LABELS[user.role]}
            </p>
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <button className={item} onClick={toggle}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Modo {theme === 'dark' ? 'claro' : 'escuro'}
          </button>
          <button className={item} onClick={() => { setOpen(false); setPwd(true); }}>
            <KeyRound className="h-4 w-4" /> Alterar palavra-passe
          </button>
          <button className={cn(item, 'text-red-600 dark:text-red-400')} onClick={logout}>
            <LogOut className="h-4 w-4" /> Terminar sessão
          </button>
        </div>
      )}
      <ChangePasswordModal open={pwd} onClose={() => setPwd(false)} />
    </div>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '' } });
  useEffect(() => {
    if (open) form.reset();
  }, [open, form]);
  const submit = form.handleSubmit(async (v) => {
    try {
      await api.auth.changePassword(v);
      toast.success('Palavra-passe alterada');
      onClose();
    } catch (e) {
      if (!applyServerErrors(e, form.setError)) toast.error(errorMessage(e));
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Alterar palavra-passe"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={form.formState.isSubmitting}>Guardar</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Palavra-passe actual" type="password" autoComplete="current-password" {...form.register('currentPassword')} error={form.formState.errors.currentPassword?.message} />
        <Input label="Nova palavra-passe" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres, com letras e números." {...form.register('newPassword')} error={form.formState.errors.newPassword?.message} />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function QuickButtons() {
  const quick = useQuickActions();
  const { can } = useAuth();
  return (
    <div className="hidden items-center gap-2 md:flex">
      {can('attendance:write') && (
        <Button variant="outline" size="sm" icon={<CalendarCheck className="h-4 w-4" />} onClick={quick.openCheckIn}>
          Check-in rápido
        </Button>
      )}
      {can('payments:write') && (
        <Button size="sm" icon={<CreditCard className="h-4 w-4" />} onClick={() => quick.openPayment()}>
          Registar pagamento
        </Button>
      )}
    </div>
  );
}

function MobileFab() {
  const quick = useQuickActions();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const actions = [
    can('members:write') && { label: 'Novo membro', icon: UserPlus, run: quick.openNewMember },
    can('payments:write') && { label: 'Registar pagamento', icon: CreditCard, run: () => quick.openPayment() },
    can('attendance:write') && { label: 'Check-in rápido', icon: CalendarCheck, run: quick.openCheckIn },
  ].filter(Boolean) as { label: string; icon: typeof Plus; run: () => void }[];
  if (actions.length === 0) return <span className="w-12" />;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Acções rápidas" className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30">
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
      {open && (
        <div className="animate-slide-up absolute bottom-16 left-1/2 w-56 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {actions.map((a) => (
            <button key={a.label} onClick={() => { setOpen(false); a.run(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
              <a.icon className="h-5 w-5 text-brand-600" /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const { can } = useAuth();
  // Prioridade à recepção: Presenças; sem essa permissão, Pagamentos.
  const pick = (paths: string[]) => paths.map((p) => NAV_ITEMS.find((i) => i.to === p)!).filter((i) => can(i.permission));
  const left = pick(['/', '/members']);
  const right = pick(['/attendance', '/payments']).slice(0, 1);
  const link = ({ isActive }: { isActive: boolean }) => cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500');
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-end justify-around px-2">
        {left.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/'} className={link}>
            <i.icon className="h-5 w-5" />
            {i.label}
          </NavLink>
        ))}
        <MobileFab />
        {right.map((i) => (
          <NavLink key={i.to} to={i.to} className={link}>
            <i.icon className="h-5 w-5" />
            {i.label}
          </NavLink>
        ))}
        <button onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <Menu className="h-5 w-5" />
          Mais
        </button>
      </div>
    </nav>
  );
}

function Shell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <NavList />
        </div>
      </aside>

      {/* Menu completo (mobile) */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-950/50" onClick={() => setMenuOpen(false)} />
          <div className="animate-slide-up pb-safe absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-slate-500" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="md:hidden">
              <Brand />
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:border-slate-300 md:ml-0 md:w-80 dark:border-slate-700 dark:bg-slate-900"
              aria-label="Pesquisa global"
            >
              <Search className="h-4 w-4" />
              <span className="hidden flex-1 text-left md:inline">Pesquisar…</span>
              <kbd className="hidden rounded border border-slate-200 px-1.5 text-xs md:inline dark:border-slate-700">⌘K</kbd>
            </button>
            <div className="flex items-center gap-3 md:ml-auto">
              <QuickButtons />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-8">
          <Outlet />
        </main>
      </div>

      <BottomNav onMore={() => setMenuOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function AppLayout() {
  return (
    <QuickActionsProvider>
      <Shell />
    </QuickActionsProvider>
  );
}
