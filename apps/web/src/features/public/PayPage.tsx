import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Dumbbell, Phone } from 'lucide-react';
import { useParams } from 'react-router';
import { formatDate, formatMoney, formatPhone } from '@gymflow/shared';
import { Badge, Card, CardBody, ErrorState, LoadingState } from '../../components/ui';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';

/**
 * Página pública do link "Pagar agora". Nesta versão mostra o resumo e as instruções;
 * a arquitectura (PaymentLink + PaymentGateway na API) está pronta para M-Pesa/e-Mola.
 */
export function PayPage() {
  const { token = '' } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['pay', token], queryFn: () => api.publicPayments.get(token), retry: false });

  return (
    <div className="flex min-h-dvh items-start justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white"><Dumbbell className="h-5 w-5" /></span>
          <span className="font-semibold">{data?.gymName ?? 'GymFlow'}</span>
        </div>
        {isLoading ? (
          <LoadingState />
        ) : error || !data ? (
          <Card><ErrorState message={error ? errorMessage(error) : 'Link inválido'} /></Card>
        ) : (
          <Card>
            <CardBody className="space-y-5">
              <div className="text-center">
                <p className="text-sm text-slate-500">Olá, {data.memberName}</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">{formatMoney(data.amountCents, data.currency)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Plano {data.planName} · {data.memberCode}
                </p>
                <div className="mt-3">
                  {data.status === 'PAID' ? (
                    <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Pago</Badge>
                  ) : data.status === 'OPEN' ? (
                    <Badge tone="amber"><Clock className="h-3 w-3" /> Vencimento {formatDate(data.dueDate)}</Badge>
                  ) : (
                    <Badge tone="gray">Link {data.status === 'EXPIRED' ? 'expirado' : 'cancelado'}</Badge>
                  )}
                </div>
              </div>
              {data.status === 'OPEN' && (
                <div className="space-y-2">
                  {data.methods.map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div>
                        <p className="text-sm font-medium">{m.label}</p>
                        {m.instructions && <p className="mt-0.5 text-xs text-slate-500">{m.instructions}</p>}
                      </div>
                      {!m.available && <Badge>Em breve</Badge>}
                    </div>
                  ))}
                </div>
              )}
              {(data.gymPhone || data.gymWhatsapp) && (
                <a href={`https://wa.me/${data.gymWhatsapp ?? data.gymPhone}`} className="flex items-center justify-center gap-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
                  <Phone className="h-4 w-4" /> Contactar o ginásio: {formatPhone(data.gymWhatsapp ?? data.gymPhone)}
                </a>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
