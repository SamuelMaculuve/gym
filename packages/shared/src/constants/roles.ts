export const ROLES = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  RECEPTIONIST: 'Recepcionista',
  ACCOUNTANT: 'Contabilista',
};

export const PERMISSIONS = [
  'dashboard:view',
  'members:read',
  'members:write',
  'plans:read',
  'plans:write',
  'subscriptions:read',
  'subscriptions:write',
  'payments:read',
  'payments:write',
  'payments:cancel',
  'attendance:read',
  'attendance:write',
  'reports:read',
  'notifications:read',
  'notifications:write',
  'users:manage',
  'settings:read',
  'settings:write',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Matriz de permissões por perfil. É a única fonte de verdade:
 * a API aplica-a em cada rota e o frontend usa-a para mostrar/esconder acções.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: [
    'dashboard:view',
    'members:read',
    'members:write',
    'plans:read',
    'subscriptions:read',
    'subscriptions:write',
    'payments:read',
    'payments:write',
    'payments:cancel',
    'attendance:read',
    'attendance:write',
    'reports:read',
    'notifications:read',
    'notifications:write',
    'settings:read',
    'audit:read',
  ],
  RECEPTIONIST: [
    'dashboard:view',
    'members:read',
    'members:write',
    'plans:read',
    'subscriptions:read',
    'payments:read',
    'payments:write',
    'attendance:read',
    'attendance:write',
  ],
  ACCOUNTANT: ['dashboard:view', 'plans:read', 'subscriptions:read', 'payments:read', 'reports:read'],
};

export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
