import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanInput } from '@gymflow/shared';
import { api } from '../../lib/api';
import { qk } from '../../lib/query-keys';

export function usePlans() {
  return useQuery({ queryKey: qk.plans, queryFn: () => api.plans.list(true), staleTime: 60_000 });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PlanInput | Partial<PlanInput> }) =>
      id ? api.plans.update(id, input) : api.plans.create(input as PlanInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.plans }),
  });
}
