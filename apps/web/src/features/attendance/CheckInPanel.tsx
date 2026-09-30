import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, QrCode, ShieldAlert, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDate, formatPhone, type AttendanceMethod, type CheckInInput, type CheckInResult } from '@gymflow/shared';
import { useQuickActions } from '../../app/QuickActions';
import { Avatar, Button, controlClass, SubscriptionBadge } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useCheckIn } from './hooks';
import { QrScanner } from './QrScanner';

function detectMethod(term: string): AttendanceMethod {
  if (/^GF1:/.test(term)) return 'QR';
  if (/^[A-Z]{2,6}-\d+$/i.test(term)) return 'CODE';
  if (term.replace(/\D/g, '').length >= 9) return 'PHONE';
  return 'NAME';
}

/**
 * Check-in rápido: QR / código / telefone / nome → verificar subscrição → registar presença.
 * Também funciona com leitores USB de QR (escrevem o código e "Enter" no campo).
 */
export function CheckInPanel({ compact }: { compact?: boolean }) {
  const f = useFormat();
  const { can } = useAuth();
  const quick = useQuickActions();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [scan, setScan] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [lastInput, setLastInput] = useState<CheckInInput | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const checkIn = useCheckIn();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const candidates = useQuery({
    queryKey: ['checkin-candidates', debounced],
    queryFn: () => api.attendance.candidates(debounced),
    enabled: debounced.length >= 2 && !debounced.startsWith('GF1:'),
  });

  // Limpa o resultado positivo após alguns segundos (modo balcão)
  useEffect(() => {
    if (!result?.allowed) return;
    const t = setTimeout(() => {
      setResult(null);
      inputRef.current?.focus();
    }, 6000);
    return () => clearTimeout(t);
  }, [result]);

  const run = async (input: CheckInInput) => {
    try {
      setLastInput(input);
      const r = await checkIn.mutateAsync(input);
      setResult(r);
      setTerm('');
      if (r.allowed && !r.alreadyCheckedIn) toast.success(`${r.member.fullName}: entrada registada`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const submitTerm = () => {
    const t = term.trim();
    if (!t) return;
    const method = detectMethod(t);
    void run(method === 'QR' ? { qrToken: t, method } : { query: t, method });
  };

  return (
    <div className={cn('grid gap-5', !compact && 'lg:grid-cols-[1fr_1fr]')}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitTerm())}
            placeholder="Código, telefone ou nome"
            className={cn(controlClass, 'h-12 text-base')}
            aria-label="Pesquisar membro para check-in"
          />
          <Button size="lg" variant={scan ? 'secondary' : 'outline'} onClick={() => setScan((s) => !s)} aria-label="Ler QR Code" icon={<QrCode className="h-5 w-5" />}>
            <span className="hidden sm:inline">QR</span>
          </Button>
        </div>

        {scan && <QrScanner paused={checkIn.isPending} onResult={(value) => run({ qrToken: value, method: 'QR' })} />}

        {debounced.length >= 2 && !scan && (candidates.data?.length ?? 0) > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {candidates.data!.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => run({ memberId: c.id, method: detectMethod(term) === 'PHONE' ? 'PHONE' : detectMethod(term) === 'CODE' ? 'CODE' : 'NAME' })}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Avatar name={c.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {c.code} · {formatPhone(c.phone)}
                    </p>
                  </div>
                  <SubscriptionBadge status={c.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {debounced.length >= 2 && candidates.data?.length === 0 && !scan && <p className="text-sm text-slate-500">Nenhum membro encontrado.</p>}
      </div>

      <div>
        {checkIn.isPending ? (
          <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-500 dark:border-slate-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : result ? (
          <div
            className={cn(
              'animate-fade-in flex flex-col items-center gap-3 rounded-2xl p-6 text-center',
              result.allowed ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100' : 'bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-100',
            )}
            role="status"
          >
            {result.allowed ? <CheckCircle2 className="h-12 w-12 text-emerald-600" /> : <XCircle className="h-12 w-12 text-red-600" />}
            <div>
              <p className="text-lg font-semibold">{result.member.fullName}</p>
              <p className="text-sm opacity-80">
                {result.member.code}
                {result.member.planName && ` · ${result.member.planName}`}
                {result.member.endDate && ` · até ${formatDate(result.member.endDate)}`}
              </p>
            </div>
            <SubscriptionBadge status={result.status} />
            <p className="text-base font-medium">{result.message}</p>
            {result.attendance && (
              <p className="text-xs opacity-70">
                Entrada às {f.time(result.attendance.checkInAt)}
                {result.attendance.overridden && ' · autorizada manualmente'}
              </p>
            )}
            {!result.allowed && (
              <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
                {can('payments:write') && (
                  <Button className="flex-1" onClick={() => quick.openPayment(result.member.id)}>
                    Registar pagamento
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  icon={<ShieldAlert className="h-4 w-4" />}
                  onClick={() => lastInput && run({ ...lastInput, memberId: result.member.id, qrToken: undefined, query: undefined, force: true })}
                >
                  Autorizar entrada
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            <QrCode className="h-8 w-8 text-slate-300" />
            Leia o QR Code do membro ou pesquise pelo código, telefone ou nome.
          </div>
        )}
      </div>
    </div>
  );
}
