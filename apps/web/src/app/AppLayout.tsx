import { zodResolver } from '@hookform/resolvers/zod';
import { Bell, CalendarCheck, ChevronDown, CreditCard, Dumbbell, KeyRound, LogOut, Menu, Moon, Plus, Search, Sun, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
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

/** Fecha um menu flutuante ao clicar fora dele. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

const roundBase = 'flex h-11 w-11 items-center justify-center rounded-full transition-colors';
const roundBtn = cn(roundBase, 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800');
const popover = 'animate-fade-in absolute right-0 z-40 mt-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900';
const popItem = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';

/** Alterna entre modo claro e escuro (a escolha fica guardada neste browser). */
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro';
  return (
    <button onClick={toggle} className={roundBtn} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  const { gym } = useAuth();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-3">
      {gym?.logoUrl ? (
        <img src={gym.logoUrl} alt="" className={cn('rounded-2xl object-cover', compact ? 'h-9 w-9' : 'h-12 w-12')} />
      ) : (
        <span className={cn('flex shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-brand-300 dark:border dark:border-slate-800', compact ? 'h-9 w-9' : 'h-12 w-12')}>
          <Dumbbell className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <p className={cn('truncate font-medium text-slate-900 dark:text-white', compact ? 'text-sm' : 'text-xl')}>{gym?.name ?? 'GymFlow'}</p>
        <p className={cn('truncate text-slate-500 dark:text-slate-400', compact ? 'text-xs' : 'text-sm')}>Gestão de ginásio</p>
      </div>
    </Link>
  );
}

/** Navegação em pílula (desktop): itens principais + "Mais". */
function TopNav() {
  const { can } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  useEffect(close, [location.pathname, close]);

  const items = NAV_ITEMS.filter((i) => can(i.permission));
  const primary = items.filter((i) => i.primary);
  const more = items.filter((i) => !i.primary);
  const activeMore = more.find((i) => location.pathname.startsWith(i.to));
  const pill = (active: boolean) =>
    cn(
      'flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
      active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
    );

  return (
    <nav className="flex items-center gap-0.5 rounded-full bg-slate-100 p-1 dark:bg-slate-900" aria-label="Navegação principal">
      {primary.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => pill(isActive)}>
          {item.label}
        </NavLink>
      ))}
      {more.length > 0 && (
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((o) => !o)} className={pill(!!activeMore)} aria-expanded={open}>
            {activeMore?.label ?? 'Mais'} <ChevronDown className="h-4 w-4" />
          </button>
          {open && (
            <div className={cn(popover, 'w-56')}>
              {more.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => cn(popItem, isActive && 'bg-slate-100 font-medium dark:bg-slate-800')}>
                  <item.icon className="h-4 w-4 text-slate-500" /> {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

/** Lista vertical usada no menu completo (mobile). */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <nav className="grid grid-cols-2 gap-2">
      {NAV_ITEMS.filter((i) => can(i.permission)).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-300 text-slate-950' : 'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200',
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
  const ref = useDismiss(open, useCallback(() => setOpen(false), []));
  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex rounded-full ring-offset-2 ring-offset-slate-50 hover:ring-2 hover:ring-brand-300 dark:ring-offset-slate-950" aria-label="Menu do utilizador">
        <Avatar name={user.name} />
      </button>
      {open && (
        <div className={cn(popover, 'w-64')}>
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-slate-500">
              {user.email} · {ROLE_LABELS[user.role]}
            </p>
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <button className={popItem} onClick={toggle}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Modo {theme === 'dark' ? 'claro' : 'escuro'}
          </button>
          <button className={popItem} onClick={() => { setOpen(false); setPwd(true); }}>
            <KeyRound className="h-4 w-4" /> Alterar palavra-passe
          </button>
          <button className={cn(popItem, 'text-red-600 dark:text-red-400')} onClick={logout}>
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

function useQuickList() {
  const quick = useQuickActions();
  const { can } = useAuth();
  return [
    can('members:write') && { label: 'Novo membro', icon: UserPlus, run: quick.openNewMember },
    can('payments:write') && { label: 'Registar pagamento', icon: CreditCard, run: () => quick.openPayment() },
    can('attendance:write') && { label: 'Check-in rápido', icon: CalendarCheck, run: quick.openCheckIn },
  ].filter(Boolean) as { label: string; icon: typeof Plus; run: () => void }[];
}

/** Botão redondo "+" com as acções rápidas da recepção (desktop). */
function QuickMenu() {
  const actions = useQuickList();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, useCallback(() => setOpen(false), []));
  if (actions.length === 0) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={cn(roundBase, 'bg-brand-300 text-slate-950 hover:bg-brand-200')} aria-label="Acções rápidas" title="Acções rápidas">
        <Plus className="h-5 w-5" />
      </button>
      {open && (
        <div className={cn(popover, 'w-60')}>
          {actions.map((a) => (
            <button key={a.label} className={popItem} onClick={() => { setOpen(false); a.run(); }}>
              <a.icon className="h-4 w-4 text-brand-700 dark:text-brand-300" /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileFab() {
  const actions = useQuickList();
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return <span className="w-12" />;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Acções rápidas" className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-300 text-slate-950 shadow-lg shadow-brand-300/30">
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
      {open && (
        <div className="animate-slide-up absolute bottom-16 left-1/2 w-56 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {actions.map((a) => (
            <button key={a.label} onClick={() => { setOpen(false); a.run(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
              <a.icon className="h-5 w-5 text-brand-700 dark:text-brand-300" /> {a.label}
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
  const link = ({ isActive }: { isActive: boolean }) => cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500');
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95">
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
  const { can } = useAuth();
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
      {/* Menu completo (mobile) */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-950/60" onClick={() => setMenuOpen(false)} />
          <div className="animate-slide-up pb-safe absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <Brand compact />
              <button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-slate-500" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-slate-50/85 backdrop-blur dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:h-24 lg:px-8">
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <div className="hidden w-64 shrink-0 lg:block">
            <Brand />
          </div>
          <div className="hidden flex-1 justify-center lg:flex">
            <TopNav />
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:w-64 lg:justify-end">
            <button onClick={() => setPaletteOpen(true)} className={roundBtn} aria-label="Pesquisa global (⌘K)" title="Pesquisar (⌘K)">
              <Search className="h-5 w-5" />
            </button>
            <ThemeToggle />
            {can('notifications:read') && (
              <Link to="/notifications" className={cn(roundBtn, 'hidden sm:flex')} aria-label="Notificações" title="Notificações">
                <Bell className="h-5 w-5" />
              </Link>
            )}
            <div className="hidden lg:block">
              <QuickMenu />
            </div>
            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-800" />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:pb-12">
        <Outlet />
      </main>

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
