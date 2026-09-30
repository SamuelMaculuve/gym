import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEndDate, evaluateSubscription, nextPeriodStart } from './subscription-status.ts';
import { latestOverdueThreshold, resolveReminderCandidates, type ReminderSettings } from './reminders.ts';

const rules = { dueSoonDays: 7, expireAfterDays: 30 };
const base = { startDate: '2026-09-01', endDate: '2026-09-30', amountCents: 150000, amountPaidCents: 150000, state: 'NORMAL' as const };

test('período pago e longe do vencimento está activo', () => {
  assert.equal(evaluateSubscription(base, '2026-09-10', rules).status, 'ACTIVE');
});

test('vence hoje fica "a vencer" e nunca é considerado pago sem pagamento', () => {
  const e = evaluateSubscription(base, '2026-09-30', rules);
  assert.equal(e.status, 'DUE_SOON');
  assert.equal(e.daysUntilDue, 0);
  const unpaid = evaluateSubscription({ ...base, amountPaidCents: 0 }, '2026-09-30', rules);
  assert.equal(unpaid.paid, false);
  assert.equal(unpaid.status, 'OVERDUE');
});

test('no dia seguinte ao vencimento passa a em atraso e depois expira', () => {
  assert.equal(evaluateSubscription(base, '2026-10-01', rules).status, 'OVERDUE');
  assert.equal(evaluateSubscription(base, '2026-11-01', rules).status, 'EXPIRED');
});

test('datas de término e renovação', () => {
  assert.equal(computeEndDate('2026-09-01', 30), '2026-09-30');
  assert.equal(nextPeriodStart('2026-09-30', '2026-10-05', rules), '2026-10-01');
  assert.equal(nextPeriodStart('2026-01-31', '2026-10-05', rules), '2026-10-05');
});

const settings: ReminderSettings = {
  whatsappEnabled: true, emailEnabled: true, smsEnabled: false,
  daysBefore: [7, 3, 1], sendOnDueDate: true, overdueDays: [1, 7, 14], overdueRepeatEveryDays: 7,
  sendExpiredNotice: true, sendHour: 9, sendWelcome: true, sendPaymentConfirmation: true,
};

test('limiares de atraso com repetição semanal', () => {
  assert.equal(latestOverdueThreshold(0, settings), null);
  assert.equal(latestOverdueThreshold(1, settings), 1);
  assert.equal(latestOverdueThreshold(6, settings), 1);
  assert.equal(latestOverdueThreshold(14, settings), 14);
  assert.equal(latestOverdueThreshold(20, settings), 14);
  assert.equal(latestOverdueThreshold(21, settings), 21);
  assert.equal(latestOverdueThreshold(29, settings), 28);
});

test('candidatos a lembrete', () => {
  const at = (today: string) => resolveReminderCandidates(evaluateSubscription(base, today, rules), settings);
  assert.deepEqual(at('2026-09-23'), [{ type: 'DUE_REMINDER', threshold: 'before:7' }]);
  assert.deepEqual(at('2026-09-25'), [{ type: 'DUE_REMINDER', threshold: 'before:7' }]);
  assert.deepEqual(at('2026-09-27'), [{ type: 'DUE_REMINDER', threshold: 'before:3' }]);
  assert.deepEqual(at('2026-09-30'), [{ type: 'DUE_TODAY', threshold: 'due' }]);
  assert.deepEqual(at('2026-10-01'), [{ type: 'OVERDUE', threshold: 'overdue:1' }]);
  assert.deepEqual(at('2026-09-10'), []);
});
