import type {
  AttendanceMethod,
  Gender,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaymentMethod,
  PaymentSource,
  PaymentStatus,
  Permission,
  Role,
  SubscriptionState,
  SubscriptionStatus,
} from '../constants';
import type { AttendanceStats } from '../domain/attendance';
import type { ISODate } from '../domain/dates';
import type { ReminderSettings } from '../domain/reminders';

/** Datas-hora (instantes) são sempre strings ISO 8601 em UTC. */
export type ISODateTime = string;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// ------------------------------- Auth -------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  gymId: string;
  permissions: Permission[];
}

export interface SessionResponse {
  token: string;
  expiresAt: ISODateTime;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
  gym: GymPublic;
}

// ------------------------------- Gym --------------------------------

export interface GymPublic {
  id: string;
  name: string;
  logoUrl: string | null;
  currency: string;
  timezone: string;
  today: ISODate;
}

export interface GymSettings {
  id: string;
  name: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp: string | null;
  currency: string;
  timezone: string;
  openingDays: number[];
  openingTime: string;
  closingTime: string;
  memberCodePrefix: string;
  dueSoonDays: number;
  expireAfterDays: number;
  paymentLinkEnabled: boolean;
  notifications: ReminderSettings;
  /** Estado dos fornecedores configurados na API (sem expor credenciais). */
  providers: Record<NotificationChannel, { provider: string; configured: boolean }>;
}

// ------------------------------- Plans ------------------------------

export interface PlanDTO {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationDays: number;
  durationLabel: string | null;
  active: boolean;
  activeSubscriptions: number;
  createdAt: ISODateTime;
}

// --------------------------- Subscriptions --------------------------

export interface MemberRef {
  id: string;
  code: string;
  fullName: string;
  phone: string;
}

export interface SubscriptionDTO {
  id: string;
  memberId: string;
  member?: MemberRef;
  plan: { id: string; name: string; durationDays: number };
  startDate: ISODate;
  endDate: ISODate;
  amountCents: number;
  amountPaidCents: number;
  paidAt: ISODateTime | null;
  state: SubscriptionState;
  status: SubscriptionStatus;
  paid: boolean;
  dueDate: ISODate;
  daysUntilDue: number;
  daysOverdue: number;
  remindersPaused: boolean;
  lastPaymentDate: ISODate | null;
  suspendedAt: ISODateTime | null;
  cancelledAt: ISODateTime | null;
  stateReason: string | null;
  createdAt: ISODateTime;
}

// ------------------------------ Members -----------------------------

export interface MemberListItem {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string | null;
  planName: string | null;
  joinedAt: ISODate;
  dueDate: ISODate | null;
  endDate: ISODate | null;
  status: SubscriptionStatus | null;
  active: boolean;
  isActive: boolean;
  lastPaymentDate: ISODate | null;
  subscriptionId: string | null;
  notificationsEnabled: boolean;
}

export interface MemberDTO {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string | null;
  birthDate: ISODate | null;
  gender: Gender | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  joinedAt: ISODate;
  active: boolean;
  notificationsEnabled: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface MemberDetail extends MemberDTO {
  currentSubscription: SubscriptionDTO | null;
  subscriptions: SubscriptionDTO[];
  payments: PaymentDTO[];
  notifications: NotificationDTO[];
  attendance: AttendanceDTO[];
  attendanceStats: AttendanceStats;
  totalPaidCents: number;
}

export interface MemberCreateResponse {
  member: MemberDTO;
  subscription: SubscriptionDTO | null;
  payment: PaymentDTO | null;
}

export interface MemberQr {
  memberId: string;
  code: string;
  fullName: string;
  /** Valor codificado no QR Code: identificador aleatório, sem dados pessoais. */
  qrValue: string;
}

// ------------------------------ Payments ----------------------------

export interface PaymentDTO {
  id: string;
  receiptNumber: string;
  memberId: string;
  member?: MemberRef;
  subscriptionId: string | null;
  planName: string | null;
  periodStart: ISODate | null;
  periodEnd: ISODate | null;
  amountCents: number;
  paymentDate: ISODate;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  source: PaymentSource;
  receivedBy: { id: string; name: string } | null;
  cancelledBy: { id: string; name: string } | null;
  cancelledAt: ISODateTime | null;
  cancelReason: string | null;
  createdAt: ISODateTime;
}

export interface PaymentCreateResponse {
  payment: PaymentDTO;
  subscription: SubscriptionDTO;
  notificationsQueued: number;
}

export interface PaymentSummary {
  totalCents: number;
  count: number;
  byMethod: { method: PaymentMethod; totalCents: number; count: number }[];
}

// ----------------------------- Attendance ---------------------------

export interface AttendanceDTO {
  id: string;
  memberId: string;
  member?: MemberRef;
  date: ISODate;
  checkInAt: ISODateTime;
  checkOutAt: ISODateTime | null;
  method: AttendanceMethod;
  subscriptionStatus: SubscriptionStatus | null;
  overridden: boolean;
  registeredBy: { id: string; name: string } | null;
}

export interface CheckInResult {
  allowed: boolean;
  /** Presença registada (null se bloqueada). */
  attendance: AttendanceDTO | null;
  member: MemberRef & { planName: string | null; endDate: ISODate | null };
  status: SubscriptionStatus | null;
  message: string;
  alreadyCheckedIn: boolean;
}

export interface CheckInCandidate extends MemberRef {
  status: SubscriptionStatus | null;
}

// --------------------------- Notifications --------------------------

export interface NotificationDTO {
  id: string;
  memberId: string | null;
  member?: MemberRef | null;
  channel: NotificationChannel;
  type: NotificationType;
  recipient: string;
  subject: string | null;
  message: string;
  status: NotificationStatus;
  error: string | null;
  sentAt: ISODateTime | null;
  createdAt: ISODateTime;
  triggeredBy: string;
}

export interface TemplateDTO {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  active: boolean;
  updatedAt: ISODateTime;
}

export interface ReminderRunResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  items: {
    memberId: string;
    memberName: string;
    type: NotificationType;
    channel: NotificationChannel;
    status: NotificationStatus | 'WOULD_SEND';
  }[];
}

// ------------------------------ Dashboard ---------------------------

export interface DashboardSummary {
  today: ISODate;
  currency: string;
  totals: {
    members: number;
    activeMembers: number;
    inactiveMembers: number;
    dueToday: number;
    dueNext7Days: number;
    overdue: number;
    revenueThisMonthCents: number;
    revenuePrevMonthCents: number;
    paymentsThisMonth: number;
    newMembersThisMonth: number;
    attendanceToday: number;
    attendanceThisWeek: number;
  };
  revenueByMonth: { month: string; totalCents: number; count: number }[];
  subscriptionStatus: { status: SubscriptionStatus; count: number }[];
  paymentStatus: { paid: number; pending: number; overdue: number };
  topAttendees: (MemberRef & { visits: number })[];
  inactiveAttendees: (MemberRef & { lastVisit: ISODate | null; days: number | null })[];
  recentPayments: PaymentDTO[];
  recentMembers: (MemberRef & { joinedAt: ISODate })[];
}

// ------------------------------- Reports ----------------------------

export interface FinancialReport {
  from: ISODate;
  to: ISODate;
  groupBy: 'day' | 'week' | 'month' | 'year';
  currency: string;
  totalCents: number;
  count: number;
  refundedCents: number;
  series: { period: string; totalCents: number; count: number }[];
  byPlan: { planName: string; totalCents: number; count: number }[];
  byMethod: { method: PaymentMethod; totalCents: number; count: number }[];
  payments: PaymentDTO[];
}

export interface MembersReport {
  from: ISODate;
  to: ISODate;
  newMembers: (MemberRef & { joinedAt: ISODate; planName: string | null })[];
  byStatus: { status: SubscriptionStatus | 'NONE'; count: number }[];
  members: MemberListItem[];
}

export interface AttendanceReport {
  from: ISODate;
  to: ISODate;
  total: number;
  byDay: { date: ISODate; count: number }[];
  byMember: (MemberRef & { visits: number; lastVisit: ISODate })[];
  byHour: { hour: number; count: number }[];
}

// ------------------------------ Users/Audit -------------------------

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface AuditLogDTO {
  id: string;
  user: { id: string; name: string; role: Role } | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: ISODateTime;
}

// ------------------------------- Search -----------------------------

export interface SearchResults {
  members: (MemberRef & { email: string | null; status: SubscriptionStatus | null })[];
  payments: (Pick<PaymentDTO, 'id' | 'receiptNumber' | 'reference' | 'amountCents' | 'paymentDate' | 'method'> & { member: MemberRef })[];
}

// --------------------------- Public payment -------------------------

export interface PublicPaymentLink {
  gymName: string;
  gymPhone: string | null;
  gymWhatsapp: string | null;
  memberName: string;
  memberCode: string;
  planName: string;
  amountCents: number;
  currency: string;
  dueDate: ISODate;
  status: 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  /** Métodos disponíveis. Por enquanto apenas instruções manuais. */
  methods: { id: string; label: string; available: boolean; instructions?: string }[];
}
