import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { controlClass } from './Field';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounce?: number;
  className?: string;
  autoFocus?: boolean;
}

/** Campo de pesquisa com debounce. */
export function SearchInput({ value, onChange, placeholder = 'Pesquisar…', debounce = 300, className, autoFocus }: Props) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), debounce);
    return () => clearTimeout(t);
  }, [local, value, onChange, debounce]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={local}
        autoFocus={autoFocus}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className={cn(controlClass, 'h-10 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {local && (
        <button
          type="button"
          aria-label="Limpar pesquisa"
          onClick={() => {
            setLocal('');
            onChange('');
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
