import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserCreateInput, UserUpdateInput } from '@gymflow/shared';
import { api } from '../../lib/api';
import { qk } from '../../lib/query-keys';

export function useUsers() {
  return useQuery({ queryKey: qk.users, queryFn: api.users.list });
}

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, create, update }: { id?: string; create?: UserCreateInput; update?: UserUpdateInput }) =>
      id ? api.users.update(id, update!) : api.users.create(create!),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
  });
}

export function useResetUserPassword() {
  return useMutation({ mutationFn: ({ id, password }: { id: string; password: string }) => api.users.resetPassword(id, password) });
}
