import type { Attendance, Member, Notification, Payment, Plan, Subscription, User } from '@prisma/client';
import {
  evaluateSubscription,
  type AttendanceDTO,
  type AttendanceMethod,
  type Gender,
  type MemberDTO,
  type MemberRef,
  type NotificationChannel,
  type NotificationDTO,
  type NotificationStatus,
  type NotificationType,
  type PaymentDTO,
  type PaymentMethod,
  type PaymentSource,
  type PaymentStatus,
  type SubscriptionDTO,
  type SubscriptionState,
  type SubscriptionStatus,
} from '@gymflow/shared';
import type { GymContext } from './gym';

type MemberRefSource = Pick<Member, 'id' | 'code' | 'fullName' | 'phone'>;

export const memberRefSelect = { id: true, code: true, fullName: true, phone: true } as const;
export const userRefSelect = { id: true, name: true } as const;

export function toMemberRef(m: MemberRefSource): MemberRef {
  return { id: m.id, code: m.code, fullName: m.fullName, phone: m.phone };
}

export function toMemberDTO(m: Member): MemberDTO {
  return {
    id: m.id,
    code: m.code,
    fullName: m.fullName,
    phone: m.phone,
    email: m.email,
    birthDate: m.birthDate,
    gender: m.gender as Gender | null,
    address: m.address,
    emergencyContactName: m.emergencyContactName,
    emergencyContactPhone: m.emergencyContactPhone,
    notes: m.notes,
    joinedAt: m.joinedAt,
    active: m.active,
    notificationsEnabled: m.notificationsEnabled,
    archivedAt: m.archivedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export type SubscriptionWithPlan = Subscription & {
  plan: Pick<Plan, 'id' | 'name' | 'durationDays'>;
  member?: MemberRefSource;
};

export function evaluate(sub: Subscription, ctx: GymContext) {
  return evaluateSubscription(
    {
      startDate: sub.startDate,
      endDate: sub.endDate,
      amountCents: sub.amountCents,
      amountPaidCents: sub.amountPaidCents,
      state: sub.state as SubscriptionState,
    },
    ctx.today,
    ctx.rules,
  );
}

export function toSubscriptionDTO(sub: SubscriptionWithPlan, ctx: GymContext, lastPaymentDate: string | null = null): SubscriptionDTO {
  const e = evaluate(sub, ctx);
  return {
    id: sub.id,
    memberId: sub.memberId,
    member: sub.member ? toMemberRef(sub.member) : undefined,
    plan: { id: sub.plan.id, name: sub.plan.name, durationDays: sub.plan.durationDays },
    startDate: sub.startDate,
    endDate: sub.endDate,
    amountCents: sub.amountCents,
    amountPaidCents: sub.amountPaidCents,
    paidAt: sub.paidAt?.toISOString() ?? null,
    state: sub.state as SubscriptionState,
    status: e.status,
    paid: e.paid,
    dueDate: e.dueDate,
    daysUntilDue: e.daysUntilDue,
    daysOverdue: e.daysOverdue,
    remindersPaused: sub.remindersPaused,
    lastPaymentDate,
    suspendedAt: sub.suspendedAt?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    stateReason: sub.stateReason,
    createdAt: sub.createdAt.toISOString(),
  };
}

export type PaymentWithRelations = Payment & {
  member?: MemberRefSource;
  subscription?: (Pick<Subscription, 'startDate' | 'endDate'> & { plan: Pick<Plan, 'name'> }) | null;
  receivedBy?: Pick<User, 'id' | 'name'> | null;
  cancelledBy?: Pick<User, 'id' | 'name'> | null;
};

export const paymentInclude = {
  member: { select: memberRefSelect },
  subscription: { select: { startDate: true, endDate: true, plan: { select: { name: true } } } },
  receivedBy: { select: userRefSelect },
  cancelledBy: { select: userRefSelect },
} as const;

export function toPaymentDTO(p: PaymentWithRelations): PaymentDTO {
  return {
    id: p.id,
    receiptNumber: p.receiptNumber,
    memberId: p.memberId,
    member: p.member ? toMemberRef(p.member) : undefined,
    subscriptionId: p.subscriptionId,
    planName: p.subscription?.plan.name ?? null,
    periodStart: p.subscription?.startDate ?? null,
    periodEnd: p.subscription?.endDate ?? null,
    amountCents: p.amountCents,
    paymentDate: p.paymentDate,
    method: p.method as PaymentMethod,
    reference: p.reference,
    notes: p.notes,
    status: p.status as PaymentStatus,
    source: p.source as PaymentSource,
    receivedBy: p.receivedBy ?? null,
    cancelledBy: p.cancelledBy ?? null,
    cancelledAt: p.cancelledAt?.toISOString() ?? null,
    cancelReason: p.cancelReason,
    createdAt: p.createdAt.toISOString(),
  };
}

export type AttendanceWithRelations = Attendance & {
  member?: MemberRefSource;
  registeredBy?: Pick<User, 'id' | 'name'> | null;
};

export function toAttendanceDTO(a: AttendanceWithRelations): AttendanceDTO {
  return {
    id: a.id,
    memberId: a.memberId,
    member: a.member ? toMemberRef(a.member) : undefined,
    date: a.date,
    checkInAt: a.checkInAt.toISOString(),
    checkOutAt: a.checkOutAt?.toISOString() ?? null,
    method: a.method as AttendanceMethod,
    subscriptionStatus: a.subscriptionStatus as SubscriptionStatus | null,
    overridden: a.overridden,
    registeredBy: a.registeredBy ?? null,
  };
}

export function toNotificationDTO(n: Notification & { member?: MemberRefSource | null }): NotificationDTO {
  return {
    id: n.id,
    memberId: n.memberId,
    member: n.member ? toMemberRef(n.member) : n.member === null ? null : undefined,
    channel: n.channel as NotificationChannel,
    type: n.type as NotificationType,
    recipient: n.recipient,
    subject: n.subject,
    message: n.message,
    status: n.status as NotificationStatus,
    error: n.error,
    sentAt: n.sentAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    triggeredBy: n.triggeredBy,
  };
}
