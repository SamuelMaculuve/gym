import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BroadcastInput, NotificationListQuery, ReminderSendInput, SendNotificationInput, TemplateUpdateInput } from '@gymflow/shared';
import { api } from '../../lib/api';
import { qk } from '../../lib/query-keys';

export function useNotifications(params: NotificationListQuery) {
  return useQuery({ queryKey: qk.notificationList(params), queryFn: () => api.notifications.list(params), placeholderData: keepPreviousData });
}

export function useTemplates() {
  return useQuery({ queryKey: qk.templates, queryFn: api.notifications.templates });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TemplateUpdateInput }) => api.notifications.updateTemplate(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.templates }),
  });
}

export function useResetTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.notifications.resetTemplate(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.templates }) });
}

export function useRunReminders() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dryRun: boolean) => api.notifications.runReminders(dryRun), onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }) });
}

/** Pré-visualização do envio em massa (quantos recebem, quem fica de fora). Não envia nada. */
export function useBroadcastPreview(input: Pick<BroadcastInput, 'channel' | 'audience'>, enabled: boolean) {
  return useQuery({
    queryKey: [...qk.notifications, 'broadcast-preview', input.channel, input.audience],
    queryFn: () => api.notifications.broadcast({ ...input, dryRun: true }),
    enabled,
    staleTime: 0,
  });
}

export function useBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BroadcastInput) => api.notifications.broadcast({ ...input, dryRun: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}

export function useSendNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendNotificationInput) => api.notifications.send(input),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: qk.notifications }), qc.invalidateQueries({ queryKey: qk.members })]),
  });
}

export function useSendReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReminderSendInput) => api.notifications.remind(input),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: qk.notifications }), qc.invalidateQueries({ queryKey: qk.members })]),
  });
}
