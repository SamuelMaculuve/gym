import {
  Bell,
  CalendarCheck,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Repeat,
  ScrollText,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import type { Permission } from '@gymflow/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
  { to: '/members', label: 'Membros', icon: Users, permission: 'members:read' },
  { to: '/subscriptions', label: 'Subscrições', icon: Repeat, permission: 'subscriptions:read' },
  { to: '/payments', label: 'Pagamentos', icon: CreditCard, permission: 'payments:read' },
  { to: '/attendance', label: 'Presenças', icon: CalendarCheck, permission: 'attendance:read' },
  { to: '/plans', label: 'Planos', icon: ListChecks, permission: 'plans:read' },
  { to: '/reports', label: 'Relatórios', icon: FileBarChart, permission: 'reports:read' },
  { to: '/notifications', label: 'Notificações', icon: Bell, permission: 'notifications:read' },
  { to: '/users', label: 'Utilizadores', icon: UserCog, permission: 'users:manage' },
  { to: '/settings', label: 'Configurações', icon: Settings, permission: 'settings:read' },
  { to: '/audit', label: 'Auditoria', icon: ScrollText, permission: 'audit:read' },
];
