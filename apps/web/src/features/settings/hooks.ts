import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuditListQuery, GymSettingsInput } from '@gymflow/shared';
import { api } from '../../lib/api';
import { qk } from '../../lib/query-keys';

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: api.settings.get });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GymSettingsInput) => api.settings.update(input),
    onSuccess: (data) => {
      qc.setQueryData(qk.settings, data);
      return Promise.all([qc.invalidateQueries({ queryKey: qk.me }), qc.invalidateQueries({ queryKey: qk.dashboard }), qc.invalidateQueries({ queryKey: qk.members })]);
    },
  });
}

export function useAudit(params: AuditListQuery) {
  return useQuery({ queryKey: qk.audit(params), queryFn: () => api.audit.list(params) });
}
