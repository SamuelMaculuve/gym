import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { SubscriptionCreateInput, SubscriptionListQuery } from '@gymflow/shared';
import { api } from '../../lib/api';
import { qk } from '../../lib/query-keys';
import { useInvalidateBusiness } from '../members/hooks';

export function useSubscriptions(params: SubscriptionListQuery) {
  return useQuery({ queryKey: qk.subscriptionList(params), queryFn: () => api.subscriptions.list(params), placeholderData: keepPreviousData });
}

type Action = { id: string; action: 'suspend' | 'resume' | 'cancel'; reason?: string } | { id: string; action: 'reminders'; paused: boolean };

export function useSubscriptionAction() {
  const invalidate = useInvalidateBusiness();
  return useMutation({
    mutationFn: (a: Action) => {
      switch (a.action) {
        case 'suspend':
          return api.subscriptions.suspend(a.id, { reason: a.reason });
        case 'resume':
          return api.subscriptions.resume(a.id);
        case 'cancel':
          return api.subscriptions.cancel(a.id, { reason: a.reason });
        case 'reminders':
          return api.subscriptions.setReminders(a.id, a.paused);
      }
    },
    onSuccess: invalidate,
  });
}

export function useCreateSubscription() {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: (input: SubscriptionCreateInput) => api.subscriptions.create(input), onSuccess: invalidate });
}
