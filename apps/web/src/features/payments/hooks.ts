import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { PaymentCancelInput, PaymentCreateInput, PaymentListQuery } from '@gymflow/shared';
import { api } from '../../lib/api';
import { qk } from '../../lib/query-keys';
import { useInvalidateBusiness } from '../members/hooks';

export function usePayments(params: PaymentListQuery) {
  return useQuery({ queryKey: qk.paymentList(params), queryFn: () => api.payments.list(params), placeholderData: keepPreviousData });
}

export function useRegisterPayment() {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: (input: PaymentCreateInput) => api.payments.create(input), onSuccess: invalidate });
}

export function useCancelPayment() {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: PaymentCancelInput }) => api.payments.cancel(id, input), onSuccess: invalidate });
}
