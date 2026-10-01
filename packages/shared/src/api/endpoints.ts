import type {
  AttendanceListQuery,
  AuditListQuery,
  ChangePasswordInput,
  CheckInInput,
  ForgotPasswordInput,
  GymSettingsInput,
  LoginInput,
  ManualAttendanceInput,
  MemberCreateInput,
  MemberListQuery,
  MemberUpdateInput,
  NotificationListQuery,
  PaymentCancelInput,
  PaymentCreateInput,
  PaymentListQuery,
  PlanInput,
  ReportQuery,
  ReminderSendInput,
  ResetPasswordInput,
  SetupInput,
  SetupStatus,
  SendNotificationInput,
  BroadcastInput,
  SubscriptionActionInput,
  SubscriptionCreateInput,
  SubscriptionListQuery,
  TemplateUpdateInput,
  UserCreateInput,
  UserUpdateInput,
} from '../schemas';
import type {
  AttendanceDTO,
  AttendanceReport,
  AuditLogDTO,
  CheckInCandidate,
  CheckInResult,
  DashboardSummary,
  FinancialReport,
  GymSettings,
  MeResponse,
  MemberCreateResponse,
  MemberDetail,
  MemberDTO,
  MemberListItem,
  MemberQr,
  MembersReport,
  NotificationDTO,
  Paginated,
  PaymentCreateResponse,
  PaymentDTO,
  PaymentSummary,
  PlanDTO,
  PublicPaymentLink,
  ReminderRunResult,
  ReminderSendResult,
  BroadcastResult,
  SearchResults,
  SessionResponse,
  SubscriptionDTO,
  TemplateDTO,
  UserDTO,
} from '../types';
import type { ApiClient, QueryParams } from './client';

const q = (v: object) => v as QueryParams;

/**
 * API tipada do GymFlow. Independente de React — reutilizável no Expo.
 */
export function createGymApi(http: ApiClient) {
  return {
    auth: {
      login: (input: LoginInput) => http.request<SessionResponse>('POST', '/api/auth/login', { body: input, auth: false }),
      logout: () => http.post<void>('/api/auth/logout'),
      me: () => http.get<MeResponse>('/api/auth/me'),
      changePassword: (input: ChangePasswordInput) => http.post<void>('/api/auth/change-password', input),
      forgotPassword: (input: ForgotPasswordInput) =>
        http.request<{ ok: true }>('POST', '/api/auth/forgot-password', { body: input, auth: false }),
      resetPassword: (input: ResetPasswordInput) =>
        http.request<{ ok: true }>('POST', '/api/auth/reset-password', { body: input, auth: false }),
    },
    setup: {
      status: () => http.request<SetupStatus>('GET', '/api/setup/status', { auth: false }),
      run: (input: SetupInput) => http.request<SessionResponse>('POST', '/api/setup', { body: input, auth: false }),
    },
    dashboard: {
      summary: () => http.get<DashboardSummary>('/api/dashboard'),
    },
    search: (term: string) => http.get<SearchResults>('/api/search', { q: term }),
    members: {
      list: (query: MemberListQuery) => http.get<Paginated<MemberListItem>>('/api/members', q(query)),
      get: (id: string) => http.get<MemberDetail>(`/api/members/${id}`),
      create: (input: MemberCreateInput) => http.post<MemberCreateResponse>('/api/members', input),
      update: (id: string, input: MemberUpdateInput) => http.patch<MemberDTO>(`/api/members/${id}`, input),
      qr: (id: string) => http.get<MemberQr>(`/api/members/${id}/qr`),
      regenerateQr: (id: string) => http.post<MemberQr>(`/api/members/${id}/qr/regenerate`),
      archive: (id: string) => http.post<MemberDTO>(`/api/members/${id}/archive`),
      restore: (id: string) => http.post<MemberDTO>(`/api/members/${id}/restore`),
    },
    plans: {
      list: (includeInactive = true) => http.get<PlanDTO[]>('/api/plans', { includeInactive }),
      create: (input: PlanInput) => http.post<PlanDTO>('/api/plans', input),
      update: (id: string, input: Partial<PlanInput>) => http.patch<PlanDTO>(`/api/plans/${id}`, input),
    },
    subscriptions: {
      list: (query: SubscriptionListQuery) => http.get<Paginated<SubscriptionDTO>>('/api/subscriptions', q(query)),
      create: (input: SubscriptionCreateInput) => http.post<SubscriptionDTO>('/api/subscriptions', input),
      suspend: (id: string, input: SubscriptionActionInput = {}) => http.post<SubscriptionDTO>(`/api/subscriptions/${id}/suspend`, input),
      resume: (id: string) => http.post<SubscriptionDTO>(`/api/subscriptions/${id}/resume`),
      cancel: (id: string, input: SubscriptionActionInput = {}) => http.post<SubscriptionDTO>(`/api/subscriptions/${id}/cancel`, input),
      setReminders: (id: string, remindersPaused: boolean) =>
        http.patch<SubscriptionDTO>(`/api/subscriptions/${id}/reminders`, { remindersPaused }),
    },
    payments: {
      list: (query: PaymentListQuery) => http.get<Paginated<PaymentDTO> & { summary: PaymentSummary }>('/api/payments', q(query)),
      get: (id: string) => http.get<PaymentDTO>(`/api/payments/${id}`),
      create: (input: PaymentCreateInput) => http.post<PaymentCreateResponse>('/api/payments', input),
      cancel: (id: string, input: PaymentCancelInput) => http.post<PaymentDTO>(`/api/payments/${id}/cancel`, input),
    },
    attendance: {
      list: (query: AttendanceListQuery) => http.get<Paginated<AttendanceDTO>>('/api/attendance', q(query)),
      candidates: (term: string) => http.get<CheckInCandidate[]>('/api/attendance/candidates', { q: term }),
      checkIn: (input: CheckInInput) => http.post<CheckInResult>('/api/attendance/check-in', input),
      checkOut: (id: string) => http.post<AttendanceDTO>(`/api/attendance/${id}/check-out`),
      createManual: (input: ManualAttendanceInput) => http.post<AttendanceDTO>('/api/attendance', input),
    },
    notifications: {
      list: (query: NotificationListQuery) => http.get<Paginated<NotificationDTO>>('/api/notifications', q(query)),
      send: (input: SendNotificationInput) => http.post<NotificationDTO[]>('/api/notifications/send', input),
      remind: (input: ReminderSendInput) => http.post<ReminderSendResult>('/api/notifications/remind', input),
      broadcast: (input: BroadcastInput) => http.post<BroadcastResult>('/api/notifications/broadcast', input),
      runReminders: (dryRun: boolean) => http.post<ReminderRunResult>('/api/notifications/run-reminders', { dryRun }),
      templates: () => http.get<TemplateDTO[]>('/api/notifications/templates'),
      updateTemplate: (id: string, input: TemplateUpdateInput) => http.put<TemplateDTO>(`/api/notifications/templates/${id}`, input),
      resetTemplate: (id: string) => http.post<TemplateDTO>(`/api/notifications/templates/${id}/reset`),
    },
    reports: {
      financial: (query: ReportQuery) => http.get<FinancialReport>('/api/reports/financial', q(query)),
      members: (query: ReportQuery) => http.get<MembersReport>('/api/reports/members', q(query)),
      attendance: (query: ReportQuery) => http.get<AttendanceReport>('/api/reports/attendance', q(query)),
    },
    users: {
      list: () => http.get<UserDTO[]>('/api/users'),
      create: (input: UserCreateInput) => http.post<UserDTO>('/api/users', input),
      update: (id: string, input: UserUpdateInput) => http.patch<UserDTO>(`/api/users/${id}`, input),
      resetPassword: (id: string, password: string) => http.post<void>(`/api/users/${id}/reset-password`, { password }),
    },
    settings: {
      get: () => http.get<GymSettings>('/api/settings'),
      update: (input: GymSettingsInput) => http.put<GymSettings>('/api/settings', input),
    },
    audit: {
      list: (query: AuditListQuery) => http.get<Paginated<AuditLogDTO>>('/api/audit', q(query)),
    },
    publicPayments: {
      get: (token: string) => http.request<PublicPaymentLink>('GET', `/api/public/pay/${token}`, { auth: false }),
    },
  };
}

export type GymApi = ReturnType<typeof createGymApi>;
