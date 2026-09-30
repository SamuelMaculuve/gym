import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CreditCard, Receipt, Search, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { formatDate, formatPhone } from '@gymflow/shared';
import { NAV_ITEMS } from '../app/navigation';
import { useQuickActions } from '../app/QuickActions';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { useFormat } from '../lib/format';
import { Avatar, SubscriptionBadge } from './ui';

interface Item {
  id: string;
  group: string;
  label: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  right?: ReactNode;
  run: () => void;
}

/** Pesquisa global (⌘K / Ctrl+K): membros, pagamentos, páginas e acções rápidas. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const quick = useQuickActions();
  const { can } = useAuth();
  const f = useFormat();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTerm('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 180);
    return () => clearTimeout(t);
  }, [term]);

  const results = useQuery({ queryKey: ['search', debounced], queryFn: () => api.search(debounced), enabled: open && debounced.length >= 2 });

  const items = useMemo<Item[]>(() => {
    const go = (fn: () => void) => () => {
      onClose();
      fn();
    };
    const list: Item[] = [];
    for (const m of results.data?.members ?? []) {
      list.push({
        id: `m-${m.id}`,
        group: 'Membros',
        label: m.fullName,
        sub: `${m.code} · ${formatPhone(m.phone)}${m.email ? ` · ${m.email}` : ''}`,
        icon: <Avatar name={m.fullName} size="sm" />,
        right: <SubscriptionBadge status={m.status} />,
        run: go(() => navigate(`/members/${m.id}`)),
      });
    }
    for (const p of results.data?.payments ?? []) {
      list.push({
        id: `p-${p.id}`,
        group: 'Pagamentos',
        label: `${p.receiptNumber} — ${f.money(p.amountCents)}`,
        sub: `${p.member.fullName} · ${formatDate(p.paymentDate)}${p.reference ? ` · Ref. ${p.reference}` : ''}`,
        icon: <Receipt className="h-4 w-4" />,
        run: go(() => navigate(`/members/${p.member.id}`)),
      });
    }
    const t = term.toLowerCase();
    const actions: Item[] = [];
    if (can('members:write')) actions.push({ id: 'a-new', group: 'Acções', label: 'Novo membro', icon: <UserPlus className="h-4 w-4" />, run: go(quick.openNewMember) });
    if (can('payments:write')) actions.push({ id: 'a-pay', group: 'Acções', label: 'Registar pagamento', icon: <CreditCard className="h-4 w-4" />, run: go(() => quick.openPayment()) });
    if (can('attendance:write')) actions.push({ id: 'a-checkin', group: 'Acções', label: 'Check-in rápido', icon: <CalendarCheck className="h-4 w-4" />, run: go(quick.openCheckIn) });
    const pages: Item[] = NAV_ITEMS.filter((n) => can(n.permission)).map((n) => ({
      id: `n-${n.to}`,
      group: 'Páginas',
      label: n.label,
      icon: <n.icon className="h-4 w-4" />,
      run: go(() => navigate(n.to)),
    }));
    const match = (i: Item) => !t || String(i.label).toLowerCase().includes(t);
    return [...list, ...actions.filter(match), ...pages.filter(match)];
  }, [results.data, term, can, navigate, onClose, quick, f]);

  useEffect(() => setActive(0), [items.length]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === 'Escape') onClose();
  };

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Pesquisa global">
      <div className="animate-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-slide-up relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKey}
            placeholder="Pesquisar nome, telefone, email, nº de membro ou referência…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 text-xs text-slate-400 sm:block dark:border-slate-700">ESC</kbd>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {debounced.length >= 2 && results.isFetching && items.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">A pesquisar…</li>}
          {items.length === 0 && !results.isFetching && <li className="px-3 py-6 text-center text-sm text-slate-500">Sem resultados.</li>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.id}>
                {header && <p className="px-3 pt-3 pb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">{header}</p>}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={item.run}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === active && 'bg-slate-100 dark:bg-slate-800')}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-500">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{item.label}</span>
                    {item.sub && <span className="block truncate text-xs text-slate-500">{item.sub}</span>}
                  </span>
                  {item.right}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
