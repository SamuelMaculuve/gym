import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberCreateInput, MemberListQuery, MemberUpdateInput } from '@gymflow/shared';
import { api } from '../../lib/api';
import { qk } from '../../lib/query-keys';

export function useMembers(params: MemberListQuery) {
  return useQuery({ queryKey: qk.memberList(params), queryFn: () => api.members.list(params), placeholderData: keepPreviousData });
}

export function useMember(id: string | undefined) {
  return useQuery({ queryKey: qk.member(id ?? ''), queryFn: () => api.members.get(id!), enabled: Boolean(id) });
}

export function useMemberQr(id: string | undefined) {
  return useQuery({ queryKey: qk.memberQr(id ?? ''), queryFn: () => api.members.qr(id!), enabled: Boolean(id), staleTime: Infinity });
}

/** Invalida tudo o que depende de membros/pagamentos (dashboard incluído). */
export function useInvalidateBusiness() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [qk.members, qk.subscriptions, qk.payments, qk.dashboard, qk.attendance, qk.notifications, qk.plans].map((key) => qc.invalidateQueries({ queryKey: key })),
    );
}

export function useCreateMember() {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: (input: MemberCreateInput) => api.members.create(input), onSuccess: invalidate });
}

export function useUpdateMember(id: string) {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: (input: MemberUpdateInput) => api.members.update(id, input), onSuccess: invalidate });
}

/** Arquiva (archived = true) ou restaura um membro. */
export function useArchiveMember(id: string) {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: (archived: boolean) => (archived ? api.members.archive(id) : api.members.restore(id)), onSuccess: invalidate });
}

export function useRegenerateQr(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.members.regenerateQr(id), onSuccess: (data) => qc.setQueryData(qk.memberQr(id), data) });
}
