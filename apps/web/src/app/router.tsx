import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import type { Permission } from '@gymflow/shared';
import { LoadingState } from '../components/ui';
import { LoginPage } from '../features/auth/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from '../features/auth/PasswordRecovery';
import { SetupPage } from '../features/auth/SetupPage';
import { AppLayout } from './AppLayout';
import { NotFoundPage, RequireAuth, RequirePermission } from './guards';

/** Carregamento por módulo: cada página é um chunk separado. */
function page(loader: () => Promise<Record<string, ComponentType>>, name: string) {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}

const DashboardPage = page(() => import('../features/dashboard/DashboardPage'), 'DashboardPage');
const MembersPage = page(() => import('../features/members/MembersPage'), 'MembersPage');
const MemberDetailPage = page(() => import('../features/members/MemberDetailPage'), 'MemberDetailPage');
const SubscriptionsPage = page(() => import('../features/subscriptions/SubscriptionsPage'), 'SubscriptionsPage');
const PaymentsPage = page(() => import('../features/payments/PaymentsPage'), 'PaymentsPage');
const AttendancePage = page(() => import('../features/attendance/AttendancePage'), 'AttendancePage');
const PlansPage = page(() => import('../features/plans/PlansPage'), 'PlansPage');
const ReportsPage = page(() => import('../features/reports/ReportsPage'), 'ReportsPage');
const NotificationsPage = page(() => import('../features/notifications/NotificationsPage'), 'NotificationsPage');
const TemplatesPage = page(() => import('../features/notifications/TemplatesPage'), 'TemplatesPage');
const UsersPage = page(() => import('../features/users/UsersPage'), 'UsersPage');
const SettingsPage = page(() => import('../features/settings/SettingsPage'), 'SettingsPage');
const AuditPage = page(() => import('../features/settings/AuditPage'), 'AuditPage');
const PayPage = page(() => import('../features/public/PayPage'), 'PayPage');

function guarded(permission: Permission, element: ReactNode) {
  return (
    <RequirePermission permission={permission}>
      <Suspense fallback={<LoadingState />}>{element}</Suspense>
    </RequirePermission>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/setup', element: <SetupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/pay/:token',
    element: (
      <Suspense fallback={<LoadingState />}>
        <PayPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: guarded('dashboard:view', <DashboardPage />) },
      { path: 'members', element: guarded('members:read', <MembersPage />) },
      { path: 'members/:id', element: guarded('members:read', <MemberDetailPage />) },
      { path: 'subscriptions', element: guarded('subscriptions:read', <SubscriptionsPage />) },
      { path: 'payments', element: guarded('payments:read', <PaymentsPage />) },
      { path: 'attendance', element: guarded('attendance:read', <AttendancePage />) },
      { path: 'plans', element: guarded('plans:read', <PlansPage />) },
      { path: 'reports', element: guarded('reports:read', <ReportsPage />) },
      { path: 'notifications', element: guarded('notifications:read', <NotificationsPage />) },
      { path: 'settings/notifications', element: guarded('notifications:read', <TemplatesPage />) },
      { path: 'users', element: guarded('users:manage', <UsersPage />) },
      { path: 'settings', element: guarded('settings:read', <SettingsPage />) },
      { path: 'audit', element: guarded('audit:read', <AuditPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
