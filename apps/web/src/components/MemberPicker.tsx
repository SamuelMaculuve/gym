import { Check, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatPhone, type MemberListItem } from '@gymflow/shared';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { Avatar, controlClass, SubscriptionBadge } from './ui';

interface Props {
  value: MemberListItem | null;
  onChange: (member: MemberListItem | null) => void;
  error?: string;
  autoFocus?: boolean;
}

/** Pesquisa rápida de membros por nome, telefone ou número de membro. */
export function MemberPicker({ value, onChange, error, autoFocus }: Props) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ['member-picker', debounced],
    queryFn: () => api.members.list({ q: debounced, pageSize: 6 }),
    enabled: debounced.length >= 2 && !value,
  });

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3 dark:border-brand-800 dark:bg-brand-900/20">
        <Avatar name={value.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{value.fullName}</p>
          <p className="text-xs text-slate-500">
            {value.code} · {formatPhone(value.phone)}
          </p>
        </div>
        <SubscriptionBadge status={value.status} />
        <button type="button" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400" onClick={() => onChange(null)}>
          Alterar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus={autoFocus}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Nome, telefone ou número de membro"
          className={cn(controlClass, 'h-11 pl-9', error && 'border-red-400')}
        />
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {debounced.length >= 2 && (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {isFetching && !data && <li className="px-3 py-3 text-sm text-slate-500">A pesquisar…</li>}
          {data?.items.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Nenhum membro encontrado.</li>}
          {data?.items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onChange(m)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                <Avatar name={m.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{m.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {m.code} · {formatPhone(m.phone)}
                  </p>
                </div>
                <SubscriptionBadge status={m.status} />
                <Check className="h-4 w-4 text-transparent" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
