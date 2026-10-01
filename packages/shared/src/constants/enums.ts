/** Estado calculado de uma subscrição (nunca guardado directamente). */
export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'DUE_SOON', 'OVERDUE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Activa',
  DUE_SOON: 'A vencer',
  OVERDUE: 'Em atraso',
  EXPIRED: 'Expirada',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
};

/** Estado administrativo guardado na base de dados. */
export const SUBSCRIPTION_STATES = ['NORMAL', 'SUSPENDED', 'CANCELLED'] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

export const PAYMENT_METHODS = ['CASH', 'MPESA', 'EMOLA', 'BANK_TRANSFER', 'CARD', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  MPESA: 'M-Pesa',
  EMOLA: 'e-Mola',
  BANK_TRANSFER: 'Transferência bancária',
  CARD: 'Cartão',
  OTHER: 'Outro',
};

export const PAYMENT_STATUSES = ['PAID', 'CANCELLED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Estornado',
};

export const PAYMENT_SOURCES = ['MANUAL', 'ONLINE'] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

export const NOTIFICATION_CHANNELS = ['WHATSAPP', 'EMAIL', 'SMS'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  SMS: 'SMS',
};

export const NOTIFICATION_TYPES = [
  'WELCOME',
  'PAYMENT_CONFIRMATION',
  'DUE_REMINDER',
  'DUE_TODAY',
  'OVERDUE',
  'EXPIRED',
  'RENEWAL',
  'PASSWORD_RESET',
  'CUSTOM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  WELCOME: 'Boas-vindas',
  PAYMENT_CONFIRMATION: 'Confirmação de pagamento',
  DUE_REMINDER: 'Lembrete de vencimento',
  DUE_TODAY: 'Vence hoje',
  OVERDUE: 'Pagamento em atraso',
  EXPIRED: 'Subscrição expirada',
  RENEWAL: 'Renovação',
  PASSWORD_RESET: 'Recuperação de conta',
  CUSTOM: 'Mensagem personalizada',
};

/** Tipos cujo template é editável pelo ginásio (PASSWORD_RESET é destinado a funcionários). */
export const MEMBER_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter(
  (t) => t !== 'PASSWORD_RESET' && t !== 'CUSTOM',
) as Exclude<NotificationType, 'PASSWORD_RESET' | 'CUSTOM'>[];

export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  PENDING: 'Pendente',
  SENT: 'Enviada',
  FAILED: 'Falhou',
  SKIPPED: 'Ignorada',
};

export const ATTENDANCE_METHODS = ['QR', 'CODE', 'PHONE', 'NAME', 'MANUAL'] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const ATTENDANCE_METHOD_LABELS: Record<AttendanceMethod, string> = {
  QR: 'QR Code',
  CODE: 'Código',
  PHONE: 'Telefone',
  NAME: 'Nome',
  MANUAL: 'Manual',
};

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  OTHER: 'Outro',
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
};

/** Filtros rápidos da lista de membros. */
export const MEMBER_FILTERS = ['all', 'active', 'inactive', 'up_to_date', 'overdue', 'due_today', 'due_7_days', 'archived'] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

export const MEMBER_FILTER_LABELS: Record<MemberFilter, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Inactivos',
  up_to_date: 'Pagamento em dia',
  overdue: 'Pagamento em atraso',
  due_today: 'Vence hoje',
  due_7_days: 'Vence em 7 dias',
  archived: 'Arquivados',
};

export const MEMBER_SORTS = ['name', 'joinedAt', 'dueDate', 'status', 'lastPayment'] as const;
export type MemberSort = (typeof MEMBER_SORTS)[number];
