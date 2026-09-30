import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export const controlClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-colors ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 ' +
  'dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-900';

interface FieldProps {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (id: string) => ReactNode;
}

/** Envolve um controlo com label, dica e mensagem de erro acessíveis. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

type Common = { label?: ReactNode; error?: string; hint?: ReactNode; containerClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common & { leading?: ReactNode }>(
  function Input({ label, error, hint, containerClassName, className, leading, required, ...props }, ref) {
    return (
      <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
        {(id) => (
          <div className="relative">
            {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{leading}</span>}
            <input
              ref={ref}
              id={id}
              aria-invalid={Boolean(error)}
              className={cn(controlClass, 'h-10', leading ? 'pl-9' : '', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20', className)}
              {...props}
            />
          </div>
        )}
      </Field>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Common>(function Textarea(
  { label, error, hint, containerClassName, className, required, ...props },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
      {(id) => (
        <textarea
          ref={ref}
          id={id}
          rows={3}
          aria-invalid={Boolean(error)}
          className={cn(controlClass, 'py-2', error && 'border-red-400', className)}
          {...props}
        />
      )}
    </Field>
  );
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Common & { options: SelectOption[]; placeholder?: string }>(
  function Select({ label, error, hint, containerClassName, className, options, placeholder, required, ...props }, ref) {
    return (
      <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
        {(id) => (
          <div className="relative">
            <select
              ref={ref}
              id={id}
              aria-invalid={Boolean(error)}
              className={cn(controlClass, 'h-10 appearance-none pr-9', error && 'border-red-400', className)}
              {...props}
            >
              {placeholder !== undefined && <option value="">{placeholder}</option>}
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        )}
      </Field>
    );
  },
);

/** Selector de data nativo (bom em mobile), com o mesmo visual dos restantes campos. */
export const DatePicker = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & Common>(function DatePicker(
  props,
  ref,
) {
  return <Input ref={ref} type="date" {...props} />;
});

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-start justify-between gap-4', disabled ? 'opacity-60' : 'cursor-pointer')}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>}
          {description && <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700',
        )}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </label>
  );
}
