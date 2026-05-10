/**
 * Centralized RBAC matrix for the admin dashboard.
 * Single source of truth used by route guards, the sidebar, and per-action checks.
 */

export type AppRole =
  | 'user'
  | 'support'
  | 'sales'
  | 'accounting'
  | 'admin'
  | 'super_admin';

export const STAFF_ROLES: AppRole[] = [
  'super_admin',
  'admin',
  'support',
  'sales',
  'accounting',
];

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin: 100,
  admin: 80,
  accounting: 60,
  sales: 60,
  support: 60,
  user: 1,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  accounting: 'Accounting',
  sales: 'Sales',
  support: 'Support',
  user: 'User',
};

/**
 * Page keys map every admin sidebar entry / route to the roles allowed to view it.
 * Per-action permissions (delete, refund, role-change…) live in PAGE_ACTIONS below.
 */
export type PageKey =
  | 'dashboard'
  | 'movies'
  | 'tvshows'
  | 'sections'
  | 'hero-slider'
  | 'banners'
  | 'users'
  | 'producers'
  | 'submissions'
  | 'finance'
  | 'rentals'
  | 'wallets'
  | 'referral-codes'
  | 'tickets'
  | 'job-listings'
  | 'job-applications'
  | 'push-notifications'
  | 'settings';

export const PAGE_ACCESS: Record<PageKey, AppRole[]> = {
  dashboard: ['super_admin', 'admin', 'support', 'sales', 'accounting'],
  movies: ['super_admin', 'admin'],
  tvshows: ['super_admin', 'admin'],
  sections: ['super_admin', 'admin', 'sales'],
  'hero-slider': ['super_admin', 'admin', 'sales'],
  banners: ['super_admin', 'admin', 'sales'],
  users: ['super_admin', 'admin', 'support', 'sales', 'accounting'],
  producers: ['super_admin', 'admin'],
  submissions: ['super_admin', 'admin'],
  finance: ['super_admin', 'admin', 'accounting', 'sales'],
  rentals: ['super_admin', 'admin', 'support', 'sales', 'accounting'],
  wallets: ['super_admin', 'admin', 'support', 'accounting'],
  'referral-codes': ['super_admin', 'admin', 'sales'],
  tickets: ['super_admin', 'admin', 'support'],
  'job-listings': ['super_admin', 'admin', 'support'],
  'job-applications': ['super_admin', 'admin', 'support'],
  'push-notifications': ['super_admin', 'admin'],
  settings: ['super_admin'],
};

/** Per-action permission matrix for sensitive in-page operations. */
export type ActionKey =
  | 'manage-roles'
  | 'delete-user'
  | 'wallet-adjustment'
  | 'manage-payouts'
  | 'issue-refund'
  | 'edit-content'
  | 'edit-marketing'
  | 'manage-tickets'
  | 'view-pii';

export const ACTION_ACCESS: Record<ActionKey, AppRole[]> = {
  'manage-roles': ['super_admin'],
  'delete-user': ['super_admin'],
  'wallet-adjustment': ['super_admin', 'accounting'],
  'manage-payouts': ['super_admin', 'accounting'],
  'issue-refund': ['super_admin', 'accounting'],
  'edit-content': ['super_admin', 'admin'],
  'edit-marketing': ['super_admin', 'admin', 'sales'],
  'manage-tickets': ['super_admin', 'admin', 'support'],
  // Per user request, sales sees customer PII for outreach.
  'view-pii': ['super_admin', 'admin', 'support', 'accounting', 'sales'],
};

export const isStaffRole = (role: AppRole | null | undefined): boolean =>
  !!role && STAFF_ROLES.includes(role);

export const roleAllowed = (
  role: AppRole | null | undefined,
  allowed: AppRole[],
): boolean => !!role && allowed.includes(role);

export const canAccessPage = (
  role: AppRole | null | undefined,
  page: PageKey,
): boolean => roleAllowed(role, PAGE_ACCESS[page]);

export const canDoAction = (
  role: AppRole | null | undefined,
  action: ActionKey,
): boolean => roleAllowed(role, ACTION_ACCESS[action]);